import { chromium, Browser, Page } from 'playwright';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Universal conversation data structure
interface ConversationMessage {
  id: string;
  timestamp: Date;
  role: 'human' | 'assistant';
  content: string;
  platform: string;
  metadata?: Record<string, any>;
}

interface Conversation {
  id: string;
  title?: string;
  platform: string;
  startDate: Date;
  endDate: Date;
  messages: ConversationMessage[];
  metadata?: Record<string, any>;
}

// Base extractor class - all platform extractors inherit from this
abstract class ConversationExtractor {
  protected browser: Browser | null = null;
  protected page: Page | null = null;

  abstract platform: string;
  abstract baseUrl: string;

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({ 
      headless: false, // Keep visible so you can handle auth
      userDataDir: './browser-data' // Persist login sessions
    });
    this.page = await this.browser.newPage();
  }

  async cleanup(): Promise<void> {
    await this.browser?.close();
  }

  abstract extractConversations(): Promise<Conversation[]>;

  // Common utility methods
  protected async waitForAuth(): Promise<void> {
    console.log(`Please log into ${this.platform} and press Enter when ready...`);
    await new Promise(resolve => process.stdin.once('data', resolve));
  }

  protected generateMessageId(conversationId: string, index: number): string {
    return `${this.platform}_${conversationId}_${index}`;
  }
}

// ChatGPT/OpenAI Extractor
class ChatGPTExtractor extends ConversationExtractor {
  platform = 'ChatGPT';
  baseUrl = 'https://chat.openai.com';

  async extractConversations(): Promise<Conversation[]> {
    await this.page!.goto(this.baseUrl);
    await this.waitForAuth();

    const conversations: Conversation[] = [];
    
    // Get all conversation links from sidebar
    await this.page!.waitForSelector('[data-testid="conversation-turn"]', { timeout: 10000 });
    
    const conversationLinks = await this.page!.$$eval(
      'a[href*="/c/"]', 
      links => links.map(link => ({
        url: (link as HTMLAnchorElement).href,
        title: link.textContent?.trim() || 'Untitled'
      }))
    );

    console.log(`Found ${conversationLinks.length} ChatGPT conversations`);

    for (const [index, link] of conversationLinks.entries()) {
      console.log(`Extracting conversation ${index + 1}/${conversationLinks.length}: ${link.title}`);
      
      await this.page!.goto(link.url);
      await this.page!.waitForTimeout(2000); // Let content load

      const messages = await this.extractMessagesFromPage();
      
      if (messages.length > 0) {
        conversations.push({
          id: link.url.split('/c/')[1],
          title: link.title,
          platform: this.platform,
          startDate: messages[0].timestamp,
          endDate: messages[messages.length - 1].timestamp,
          messages
        });
      }
    }

    return conversations;
  }

  private async extractMessagesFromPage(): Promise<ConversationMessage[]> {
    return await this.page!.evaluate(() => {
      const messages: any[] = [];
      const messageElements = document.querySelectorAll('[data-testid="conversation-turn"]');
      
      messageElements.forEach((element, index) => {
        const isUser = element.querySelector('[data-message-author-role="user"]') !== null;
        const content = element.querySelector('.whitespace-pre-wrap')?.textContent || '';
        
        if (content.trim()) {
          messages.push({
            id: `chatgpt_msg_${index}`,
            timestamp: new Date(), // ChatGPT doesn't expose timestamps easily
            role: isUser ? 'human' : 'assistant',
            content: content.trim(),
            platform: 'ChatGPT'
          });
        }
      });

      return messages;
    });
  }
}

// Claude Extractor
class ClaudeExtractor extends ConversationExtractor {
  platform = 'Claude';
  baseUrl = 'https://claude.ai';

  async extractConversations(): Promise<Conversation[]> {
    await this.page!.goto(this.baseUrl);
    await this.waitForAuth();

    const conversations: Conversation[] = [];

    // Navigate to conversations list
    await this.page!.click('[data-testid="chat-list"]', { timeout: 10000 });
    
    const conversationElements = await this.page!.$$('[data-testid="chat-item"]');
    console.log(`Found ${conversationElements.length} Claude conversations`);

    for (const [index, element] of conversationElements.entries()) {
      const title = await element.$eval('.chat-title', el => el.textContent?.trim() || 'Untitled');
      console.log(`Extracting conversation ${index + 1}/${conversationElements.length}: ${title}`);
      
      await element.click();
      await this.page!.waitForTimeout(2000);

      const messages = await this.extractClaudeMessages();
      
      if (messages.length > 0) {
        conversations.push({
          id: `claude_${index}`,
          title,
          platform: this.platform,
          startDate: messages[0].timestamp,
          endDate: messages[messages.length - 1].timestamp,
          messages
        });
      }
    }

    return conversations;
  }

  private async extractClaudeMessages(): Promise<ConversationMessage[]> {
    return await this.page!.evaluate(() => {
      const messages: any[] = [];
      const messageElements = document.querySelectorAll('[data-role="message"]');
      
      messageElements.forEach((element, index) => {
        const role = element.getAttribute('data-role') === 'user' ? 'human' : 'assistant';
        const content = element.textContent?.trim() || '';
        
        if (content) {
          messages.push({
            id: `claude_msg_${index}`,
            timestamp: new Date(),
            role,
            content,
            platform: 'Claude'
          });
        }
      });

      return messages;
    });
  }
}

// Google Gemini/Bard Extractor
class GeminiExtractor extends ConversationExtractor {
  platform = 'Gemini';
  baseUrl = 'https://gemini.google.com';

  async extractConversations(): Promise<Conversation[]> {
    await this.page!.goto(this.baseUrl);
    await this.waitForAuth();

    // Implementation would be similar to above but adapted for Gemini's DOM structure
    // Left as exercise for extension
    console.log('Gemini extraction - implement based on current DOM structure');
    return [];
  }
}

// Main orchestrator class
class ConversationArchaeologist {
  private extractors: ConversationExtractor[] = [];
  private outputDir = './extracted-conversations';

  constructor() {
    this.extractors = [
      new ChatGPTExtractor(),
      new ClaudeExtractor(),
      new GeminiExtractor()
    ];
  }

  async extractAll(): Promise<void> {
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }

    for (const extractor of this.extractors) {
      console.log(`\n🚀 Starting extraction from ${extractor.platform}...`);
      
      try {
        await extractor.initialize();
        const conversations = await extractor.extractConversations();
        
        if (conversations.length > 0) {
          this.saveConversations(extractor.platform, conversations);
          console.log(`✅ Extracted ${conversations.length} conversations from ${extractor.platform}`);
        }
      } catch (error) {
        console.error(`❌ Error extracting from ${extractor.platform}:`, error);
      } finally {
        await extractor.cleanup();
      }
    }

    await this.createUnifiedIndex();
  }

  private saveConversations(platform: string, conversations: Conversation[]): void {
    const platformDir = join(this.outputDir, platform.toLowerCase());
    if (!existsSync(platformDir)) {
      mkdirSync(platformDir, { recursive: true });
    }

    // Save individual conversations
    conversations.forEach(conv => {
      const filename = `${conv.id.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
      writeFileSync(
        join(platformDir, filename),
        JSON.stringify(conv, null, 2)
      );
    });

    // Save platform summary
    writeFileSync(
      join(platformDir, 'summary.json'),
      JSON.stringify({
        platform,
        totalConversations: conversations.length,
        totalMessages: conversations.reduce((sum, conv) => sum + conv.messages.length, 0),
        extractedAt: new Date().toISOString()
      }, null, 2)
    );
  }

  private async createUnifiedIndex(): Promise<void> {
    console.log('\n📊 Creating unified searchable index...');
    
    // This would create a unified search index
    // Could use something like Lunr.js for client-side search
    // or integrate with Elasticsearch/Algolia for more advanced search
    
    const indexData = {
      timestamp: new Date().toISOString(),
      platforms: this.extractors.map(e => e.platform),
      totalExtractions: 'See individual platform summaries'
    };

    writeFileSync(
      join(this.outputDir, 'index.json'),
      JSON.stringify(indexData, null, 2)
    );
  }
}

// Export for use
export { ConversationArchaeologist, ConversationExtractor, Conversation, ConversationMessage };

// CLI runner
if (require.main === module) {
  const archaeologist = new ConversationArchaeologist();
  archaeologist.extractAll().then(() => {
    console.log('\n🎉 Extraction complete! Check the ./extracted-conversations directory');
  }).catch(console.error);
}