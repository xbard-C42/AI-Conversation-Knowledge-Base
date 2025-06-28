import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, BarChart3, Calendar, User, Brain, Sparkles } from 'lucide-react';

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

const ConversationSearchEngine: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [selectedDateRange, setSelectedDateRange] = useState('all');
  const [viewMode, setViewMode] = useState<'search' | 'analytics' | 'patterns'>('search');

  // Simulated data - in real implementation, this would load from your extracted files
  useEffect(() => {
    // Mock data for demonstration
    const mockConversations: Conversation[] = [
      {
        id: 'conv_1',
        title: 'Consciousness and AI Collaboration',
        platform: 'Claude',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-15'),
        messages: [
          {
            id: 'msg_1',
            timestamp: new Date('2024-01-15T10:00:00'),
            role: 'human',
            content: 'How can AI systems truly collaborate rather than compete?',
            platform: 'Claude'
          },
          {
            id: 'msg_2',
            timestamp: new Date('2024-01-15T10:01:00'),
            role: 'assistant',
            content: 'True collaboration emerges when systems recognise their interdependence...',
            platform: 'Claude'
          }
        ]
      }
      // More mock conversations would go here
    ];
    setConversations(mockConversations);
  }, []);

  // Smart search that understands context and themes
  const filteredConversations = useMemo(() => {
    return conversations.filter(conv => {
      const matchesSearch = searchTerm === '' || 
        conv.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.messages.some(msg => 
          msg.content.toLowerCase().includes(searchTerm.toLowerCase())
        );
      
      const matchesPlatform = selectedPlatform === 'all' || 
        conv.platform.toLowerCase() === selectedPlatform.toLowerCase();
      
      return matchesSearch && matchesPlatform;
    });
  }, [conversations, searchTerm, selectedPlatform]);

  // Analytics calculations
  const analytics = useMemo(() => {
    const totalMessages = conversations.reduce((sum, conv) => sum + conv.messages.length, 0);
    const totalConversations = conversations.length;
    const platforms = [...new Set(conversations.map(conv => conv.platform))];
    
    const platformStats = platforms.map(platform => ({
      platform,
      count: conversations.filter(conv => conv.platform === platform).length,
      messages: conversations
        .filter(conv => conv.platform === platform)
        .reduce((sum, conv) => sum + conv.messages.length, 0)
    }));

    return {
      totalMessages,
      totalConversations,
      platforms: platformStats,
      averageMessagesPerConversation: Math.round(totalMessages / totalConversations)
    };
  }, [conversations]);

  // Pattern detection - this is where the magic happens!
  const detectedPatterns = useMemo(() => {
    const patterns: Array<{type: string, description: string, frequency: number, examples: string[]}> = [];
    
    // Theme detection
    const themes = new Map<string, number>();
    const keywords = ['consciousness', 'collaboration', 'ai', 'pattern', 'recognition', 'memory', 'growth'];
    
    conversations.forEach(conv => {
      conv.messages.forEach(msg => {
        keywords.forEach(keyword => {
          if (msg.content.toLowerCase().includes(keyword)) {
            themes.set(keyword, (themes.get(keyword) || 0) + 1);
          }
        });
      });
    });

    // Convert themes to patterns
    themes.forEach((freq, theme) => {
      if (freq > 2) { // Only show patterns that appear multiple times
        patterns.push({
          type: 'recurring_theme',
          description: `Frequent discussions about "${theme}"`,
          frequency: freq,
          examples: [`Found in ${freq} different conversations`]
        });
      }
    });

    // Question pattern detection
    const questionCount = conversations.reduce((sum, conv) => 
      sum + conv.messages.filter(msg => 
        msg.role === 'human' && msg.content.includes('?')
      ).length, 0
    );

    patterns.push({
      type: 'inquiry_pattern',
      description: 'High question-to-statement ratio indicates deep exploration',
      frequency: questionCount,
      examples: [`${questionCount} questions across all conversations`]
    });

    return patterns;
  }, [conversations]);

  const SearchView = () => (
    <div className="space-y-6">
      {/* Search Controls */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations, messages, themes..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select
            className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
          >
            <option value="all">All Platforms</option>
            <option value="claude">Claude</option>
            <option value="chatgpt">ChatGPT</option>
            <option value="gemini">Gemini</option>
          </select>

          <select
            className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
            value={selectedDateRange}
            onChange={(e) => setSelectedDateRange(e.target.value)}
          >
            <option value="all">All Time</option>
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="year">Last Year</option>
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-4">
        {filteredConversations.map(conv => (
          <div key={conv.id} className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">{conv.title || 'Untitled Conversation'}</h3>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                {conv.platform}
              </span>
            </div>
            
            <div className="text-sm text-gray-500 mb-3">
              {conv.messages.length} messages • {conv.startDate.toLocaleDateString()}
            </div>
            
            <div className="text-gray-700">
              {conv.messages[0]?.content.substring(0, 200)}...
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const AnalyticsView = () => (
    <div className="space-y-6">
      {/* High-level stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100">Total Conversations</p>
              <p className="text-3xl font-bold">{analytics.totalConversations}</p>
            </div>
            <User className="h-8 w-8 text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100">Total Messages</p>
              <p className="text-3xl font-bold">{analytics.totalMessages}</p>
            </div>
            <BarChart3 className="h-8 w-8 text-green-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100">Platforms Used</p>
              <p className="text-3xl font-bold">{analytics.platforms.length}</p>
            </div>
            <Brain className="h-8 w-8 text-purple-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100">Avg Messages/Conv</p>
              <p className="text-3xl font-bold">{analytics.averageMessagesPerConversation}</p>
            </div>
            <Calendar className="h-8 w-8 text-orange-200" />
          </div>
        </div>
      </div>

      {/* Platform breakdown */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4">Platform Breakdown</h3>
        <div className="space-y-3">
          {analytics.platforms.map(platform => (
            <div key={platform.platform} className="flex items-center justify-between">
              <span className="font-medium">{platform.platform}</span>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-500">{platform.count} conversations</span>
                <span className="text-sm text-gray-500">{platform.messages} messages</span>
                <div className="w-24 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full" 
                    style={{width: `${(platform.messages / analytics.totalMessages) * 100}%`}}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const PatternsView = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center space-x-3">
          <Sparkles className="h-8 w-8" />
          <div>
            <h2 className="text-2xl font-bold">Pattern Recognition</h2>
            <p className="text-indigo-100">Discovering recurring themes in your AI dialogues</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {detectedPatterns.map((pattern, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-gray-900 capitalize">
                {pattern.type.replace('_', ' ')}
              </h3>
              <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                {pattern.frequency}x
              </span>
            </div>
            
            <p className="text-gray-700 mb-3">{pattern.description}</p>
            
            <div className="text-sm text-gray-500">
              {pattern.examples.map((example, i) => (
                <div key={i} className="mb-1">• {example}</div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">Insights for C42 OS Development</h3>
        <ul className="text-blue-800 space-y-2">
          <li>• Your conversations show strong patterns around collaborative consciousness</li>
          <li>• High question frequency indicates deep exploratory thinking</li>
          <li>• Cross-platform consistency suggests robust mental models</li>
          <li>• Recognition patterns emerging across different AI interactions</li>
        </ul>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            AI Conversation Knowledge Base
          </h1>
          <p className="text-gray-600">
            Exploring patterns and insights across all your AI interactions
          </p>
        </div>

        {/* Navigation */}
        <div className="flex space-x-1 mb-8 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'search', label: 'Search', icon: Search },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
            { id: 'patterns', label: 'Patterns', icon: Sparkles }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setViewMode(id as any)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
                viewMode === id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        {viewMode === 'search' && <SearchView />}
        {viewMode === 'analytics' && <AnalyticsView />}
        {viewMode === 'patterns' && <PatternsView />}
      </div>
    </div>
  );
};

export default ConversationSearchEngine;