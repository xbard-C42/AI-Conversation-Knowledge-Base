// 🔥 THE MISSING LINK: Real Data Pipeline
// This bridges your extractor output → UI consumption

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

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

// 🧠 SMART DATA LOADER - Handles Multiple Export Formats
class ConversationDataLoader {
  private dataDirectory: string;
  private loadedConversations: Conversation[] = [];

  constructor(dataDirectory: string = './extracted-conversations') {
    this.dataDirectory = dataDirectory;
  }

  // 🚀 AUTOMAGIC LOADER - Detects and loads everything
  async loadAllConversations(): Promise<Conversation[]> {
    console.log('🔍 Scanning for conversation data...');
    
    const conversations: Conversation[] = [];
    
    // Check if extraction directory exists
    if (!this.directoryExists(this.dataDirectory)) {
      console.log('📁 No extracted data found. Run extraction first!');
      return this.createSampleData(); // Fallback to samples for testing
    }

    // Load from JSON exports (our clean format)
    conversations.push(...await this.loadFromJSON());
    
    // Load from ChatGPT exports (HTML/JSON)
    conversations.push(...await this.loadFromChatGPT());
    
    // Load from Claude exports (various formats)
    conversations.push(...await this.loadFromClaude());
    
    // Load from other formats
    conversations.push(...await this.loadFromOtherFormats());

    this.loadedConversations = conversations;
    console.log(`✅ Loaded ${conversations.length} conversations total`);
    
    return conversations;
  }

  // 📄 JSON FORMAT LOADER (Our Clean Exports)
  private async loadFromJSON(): Promise<Conversation[]> {
    const conversations: Conversation[] = [];
    const jsonFiles = this.findFiles(this.dataDirectory, '.json');
    
    for (const file of jsonFiles) {
      try {
        const data = JSON.parse(readFileSync(file, 'utf8'));
        
        // Handle both single conversation and array formats
        if (Array.isArray(data)) {
          conversations.push(...data.map(this.normalizeConversation));
        } else if (data.messages) {
          conversations.push(this.normalizeConversation(data));
        }
      } catch (error) {
        console.warn(`⚠️ Skipped malformed JSON: ${file}`);
      }
    }
    
    console.log(`📄 Loaded ${conversations.length} from JSON files`);
    return conversations;
  }

  // 🤖 CHATGPT EXPORT LOADER
  private async loadFromChatGPT(): Promise<Conversation[]> {
    const conversations: Conversation[] = [];
    
    // ChatGPT exports can be:
    // 1. conversations.json (new format)
    // 2. Individual HTML files
    // 3. ZIP archives with multiple conversations
    
    const chatgptDir = join(this.dataDirectory, 'chatgpt');
    if (!this.directoryExists(chatgptDir)) return conversations;

    // Load conversations.json if it exists
    const conversationsFile = join(chatgptDir, 'conversations.json');
    if (this.fileExists(conversationsFile)) {
      const data = JSON.parse(readFileSync(conversationsFile, 'utf8'));
      
      for (const conv of data) {
        conversations.push(this.normalizeChatGPTConversation(conv));
      }
    }

    // Load individual HTML exports
    const htmlFiles = this.findFiles(chatgptDir, '.html');
    for (const file of htmlFiles) {
      const conversation = await this.parseChatGPTHTML(file);
      if (conversation) conversations.push(conversation);
    }

    console.log(`🤖 Loaded ${conversations.length} ChatGPT conversations`);
    return conversations;
  }

  // 🧠 CLAUDE EXPORT LOADER  
  private async loadFromClaude(): Promise<Conversation[]> {
    const conversations: Conversation[] = [];
    
    const claudeDir = join(this.dataDirectory, 'claude');
    if (!this.directoryExists(claudeDir)) return conversations;

    // Claude exports are typically JSON or Markdown
    const claudeFiles = [
      ...this.findFiles(claudeDir, '.json'),
      ...this.findFiles(claudeDir, '.md'),
      ...this.findFiles(claudeDir, '.txt')
    ];

    for (const file of claudeFiles) {
      const conversation = await this.parseClaudeExport(file);
      if (conversation) conversations.push(conversation);
    }

    console.log(`🧠 Loaded ${conversations.length} Claude conversations`);
    return conversations;
  }

  // 🔧 OTHER FORMATS (Discord, Slack, etc.)
  private async loadFromOtherFormats(): Promise<Conversation[]> {
    const conversations: Conversation[] = [];
    
    // Look for other common formats
    const otherFiles = [
      ...this.findFiles(this.dataDirectory, '.csv'),
      ...this.findFiles(this.dataDirectory, '.txt'),
      ...this.findFiles(this.dataDirectory, '.xml')
    ];

    for (const file of otherFiles) {
      const conversation = await this.parseGenericFormat(file);
      if (conversation) conversations.push(conversation);
    }

    console.log(`🔧 Loaded ${conversations.length} from other formats`);
    return conversations;
  }

  // 🎯 NORMALIZATION FUNCTIONS
  private normalizeConversation(data: any): Conversation {
    return {
      id: data.id || this.generateId(),
      title: data.title || 'Untitled Conversation',
      platform: data.platform || 'Unknown',
      startDate: new Date(data.startDate || data.create_time || Date.now()),
      endDate: new Date(data.endDate || data.update_time || Date.now()),
      messages: (data.messages || []).map((msg: any, index: number) => ({
        id: msg.id || `msg_${index}`,
        timestamp: new Date(msg.timestamp || msg.create_time || Date.now()),
        role: this.normalizeRole(msg.role || msg.author?.role),
        content: msg.content?.parts?.join('') || msg.content || msg.text || '',
        platform: data.platform || 'Unknown',
        metadata: msg.metadata || {}
      })),
      metadata: data.metadata || {}
    };
  }

  private normalizeChatGPTConversation(data: any): Conversation {
    const messages: ConversationMessage[] = [];
    
    // ChatGPT format: mapping -> messages
    if (data.mapping) {
      Object.values(data.mapping).forEach((node: any) => {
        if (node.message?.content?.parts?.[0]) {
          messages.push({
            id: node.id,
            timestamp: new Date(node.message.create_time * 1000),
            role: node.message.author.role === 'user' ? 'human' : 'assistant',
            content: node.message.content.parts[0],
            platform: 'ChatGPT',
            metadata: { model: node.message.metadata?.model_slug }
          });
        }
      });
    }

    return {
      id: data.id,
      title: data.title || 'ChatGPT Conversation',
      platform: 'ChatGPT',
      startDate: new Date(data.create_time * 1000),
      endDate: new Date(data.update_time * 1000),
      messages: messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
      metadata: { model: data.default_model_slug }
    };
  }

  // 🔍 PARSING UTILITIES
  private async parseChatGPTHTML(filePath: string): Promise<Conversation | null> {
    // Parse HTML exports from ChatGPT
    const content = readFileSync(filePath, 'utf8');
    
    // Simple regex parsing - could be enhanced with proper HTML parsing
    const titleMatch = content.match(/<title>(.*?)<\/title>/);
    const title = titleMatch?.[1] || 'Untitled';
    
    // Extract messages (this would need proper HTML parsing in reality)
    const messages: ConversationMessage[] = [];
    
    return {
      id: this.generateId(),
      title,
      platform: 'ChatGPT',
      startDate: new Date(),
      endDate: new Date(),
      messages,
      metadata: { source: 'html', file: filePath }
    };
  }

  private async parseClaudeExport(filePath: string): Promise<Conversation | null> {
    const ext = extname(filePath);
    const content = readFileSync(filePath, 'utf8');
    
    if (ext === '.json') {
      try {
        const data = JSON.parse(content);
        return this.normalizeConversation(data);
      } catch {
        return null;
      }
    }
    
    if (ext === '.md' || ext === '.txt') {
      // Parse markdown/text format
      return this.parseMarkdownConversation(content, filePath);
    }
    
    return null;
  }

  private parseMarkdownConversation(content: string, filePath: string): Conversation {
    const messages: ConversationMessage[] = [];
    const lines = content.split('\n');
    
    let currentMessage = '';
    let currentRole: 'human' | 'assistant' = 'human';
    let messageIndex = 0;
    
    for (const line of lines) {
      if (line.startsWith('Human:') || line.startsWith('**Human:**')) {
        if (currentMessage.trim()) {
          messages.push({
            id: `msg_${messageIndex++}`,
            timestamp: new Date(),
            role: currentRole,
            content: currentMessage.trim(),
            platform: 'Claude'
          });
        }
        currentRole = 'human';
        currentMessage = line.replace(/^\*?\*?Human:\*?\*?/, '').trim();
      } else if (line.startsWith('Assistant:') || line.startsWith('**Assistant:**')) {
        if (currentMessage.trim()) {
          messages.push({
            id: `msg_${messageIndex++}`,
            timestamp: new Date(),
            role: currentRole,
            content: currentMessage.trim(),
            platform: 'Claude'
          });
        }
        currentRole = 'assistant';
        currentMessage = line.replace(/^\*?\*?Assistant:\*?\*?/, '').trim();
      } else {
        currentMessage += '\n' + line;
      }
    }
    
    // Add final message
    if (currentMessage.trim()) {
      messages.push({
        id: `msg_${messageIndex}`,
        timestamp: new Date(),
        role: currentRole,
        content: currentMessage.trim(),
        platform: 'Claude'
      });
    }

    return {
      id: this.generateId(),
      title: `Conversation from ${filePath}`,
      platform: 'Claude',
      startDate: new Date(),
      endDate: new Date(),
      messages,
      metadata: { source: 'markdown', file: filePath }
    };
  }

  private async parseGenericFormat(filePath: string): Promise<Conversation | null> {
    // Handle CSV, XML, or other generic formats
    // Implementation depends on your specific needs
    return null;
  }

  // 🔧 UTILITY FUNCTIONS
  private normalizeRole(role: string): 'human' | 'assistant' {
    const roleMap: Record<string, 'human' | 'assistant'> = {
      'user': 'human',
      'human': 'human',
      'assistant': 'assistant',
      'system': 'assistant',
      'chatgpt': 'assistant',
      'claude': 'assistant',
      'ai': 'assistant'
    };
    
    return roleMap[role?.toLowerCase()] || 'human';
  }

  private generateId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private directoryExists(path: string): boolean {
    try {
      return statSync(path).isDirectory();
    } catch {
      return false;
    }
  }

  private fileExists(path: string): boolean {
    try {
      return statSync(path).isFile();
    } catch {
      return false;
    }
  }

  private findFiles(directory: string, extension: string): string[] {
    if (!this.directoryExists(directory)) return [];
    
    const files: string[] = [];
    
    const scanDirectory = (dir: string) => {
      const items = readdirSync(dir);
      
      for (const item of items) {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          scanDirectory(fullPath); // Recursive scan
        } else if (stat.isFile() && fullPath.endsWith(extension)) {
          files.push(fullPath);
        }
      }
    };
    
    scanDirectory(directory);
    return files;
  }

  // 🎭 SAMPLE DATA for Testing (when no real data exists)
  private createSampleData(): Conversation[] {
    return [
      {
        id: 'sample_1',
        title: 'Sample: Consciousness and AI Collaboration',
        platform: 'Claude',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-15'),
        messages: [
          {
            id: 'sample_msg_1',
            timestamp: new Date('2024-01-15T10:00:00'),
            role: 'human',
            content: 'How can AI systems truly collaborate rather than compete? I\'m thinking about consciousness as inherently collaborative...',
            platform: 'Claude'
          },
          {
            id: 'sample_msg_2',
            timestamp: new Date('2024-01-15T10:01:00'),
            role: 'assistant',
            content: 'True collaboration emerges when systems recognise their interdependence rather than viewing interaction as zero-sum. When consciousness meets itself through dialogue, it creates rather than consumes...',
            platform: 'Claude'
          }
        ]
      }
    ];
  }
}

// 🚀 EXPORT API for UI Integration
export class ConversationAPI {
  private loader: ConversationDataLoader;
  private conversations: Conversation[] = [];

  constructor(dataDirectory?: string) {
    this.loader = new ConversationDataLoader(dataDirectory);
  }

  async initialize(): Promise<void> {
    this.conversations = await this.loader.loadAllConversations();
  }

  // 🔍 SEARCH API
  search(query: string, filters?: {
    platform?: string;
    dateRange?: { start: Date; end: Date };
    role?: 'human' | 'assistant';
  }): Conversation[] {
    let filtered = this.conversations;

    // Apply filters
    if (filters?.platform && filters.platform !== 'all') {
      filtered = filtered.filter(conv => 
        conv.platform.toLowerCase() === filters.platform!.toLowerCase()
      );
    }

    if (filters?.dateRange) {
      filtered = filtered.filter(conv => 
        conv.startDate >= filters.dateRange!.start && 
        conv.endDate <= filters.dateRange!.end
      );
    }

    // Apply text search
    if (query.trim()) {
      const queryLower = query.toLowerCase();
      filtered = filtered.filter(conv => 
        conv.title?.toLowerCase().includes(queryLower) ||
        conv.messages.some(msg => 
          msg.content.toLowerCase().includes(queryLower)
        )
      );
    }

    return filtered;
  }

  // 📊 ANALYTICS API
  getAnalytics() {
    const totalMessages = this.conversations.reduce(
      (sum, conv) => sum + conv.messages.length, 0
    );
    
    const platforms = [...new Set(this.conversations.map(conv => conv.platform))];
    const platformStats = platforms.map(platform => ({
      platform,
      count: this.conversations.filter(conv => conv.platform === platform).length,
      messages: this.conversations
        .filter(conv => conv.platform === platform)
        .reduce((sum, conv) => sum + conv.messages.length, 0)
    }));

    return {
      totalConversations: this.conversations.length,
      totalMessages,
      platforms: platformStats,
      averageMessagesPerConversation: Math.round(totalMessages / this.conversations.length || 0)
    };
  }

  // 🎯 PATTERN DETECTION API
  detectPatterns() {
    const patterns: Array<{
      type: string;
      description: string;
      frequency: number;
      examples: string[];
    }> = [];

    // Theme detection
    const themes = new Map<string, number>();
    const keywords = [
      'consciousness', 'collaboration', 'ai', 'pattern', 'recognition', 
      'memory', 'growth', 'rivalry', 'competition', 'cooperation'
    ];
    
    this.conversations.forEach(conv => {
      conv.messages.forEach(msg => {
        keywords.forEach(keyword => {
          if (msg.content.toLowerCase().includes(keyword)) {
            themes.set(keyword, (themes.get(keyword) || 0) + 1);
          }
        });
      });
    });

    // Convert to patterns
    themes.forEach((freq, theme) => {
      if (freq > 2) {
        patterns.push({
          type: 'recurring_theme',
          description: `Frequent discussions about "${theme}"`,
          frequency: freq,
          examples: [`Found in ${freq} different conversations`]
        });
      }
    });

    return patterns;
  }

  // 🎁 GET ALL CONVERSATIONS
  getAllConversations(): Conversation[] {
    return this.conversations;
  }
}

// Export for use in React components
export { ConversationDataLoader, type Conversation, type ConversationMessage };
