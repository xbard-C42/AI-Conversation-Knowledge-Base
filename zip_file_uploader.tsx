import React, { useState, useCallback } from 'react';
import { Upload, FileArchive, Brain, CheckCircle, AlertTriangle, Loader2, Sparkles, Zap } from 'lucide-react';

interface UploadStatus {
  total: number;
  processed: number;
  errors: string[];
  currentFile: string;
}

interface ZipFileUploaderProps {
  onConversationsLoaded: (conversations: any[]) => void;
  onError?: (error: string) => void;
}

const ZipFileUploader: React.FC<ZipFileUploaderProps> = ({ onConversationsLoaded, onError }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const [completedFiles, setCompletedFiles] = useState<string[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  // 🎯 DRAG & DROP HANDLERS
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const zipFiles = files.filter(file => file.name.endsWith('.zip'));
    
    if (zipFiles.length > 0) {
      processZipFiles(zipFiles);
    } else {
      onError?.('Please drop a .zip file containing your conversation exports');
    }
  }, [onError]);

  // 📁 FILE INPUT HANDLER
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const zipFiles = files.filter(file => file.name.endsWith('.zip'));
    
    if (zipFiles.length > 0) {
      processZipFiles(zipFiles);
    }
  }, []);

  // 🚀 MAIN ZIP PROCESSING FUNCTION
  const processZipFiles = async (files: File[]) => {
    setIsProcessing(true);
    setUploadStatus(null);
    setCompletedFiles([]);
    setShowSuccess(false);

    try {
      // Dynamic import to avoid bundle issues
      const { loadConversationsFromZip } = await import('./zip-conversation-loader');
      
      const allConversations: any[] = [];

      for (const file of files) {
        console.log(`🔍 Processing ${file.name}...`);
        
        const conversations = await loadConversationsFromZip(file, (status) => {
          setUploadStatus(status);
        });

        allConversations.push(...conversations);
        setCompletedFiles(prev => [...prev, file.name]);
      }

      // 🎉 SUCCESS! 
      setShowSuccess(true);
      onConversationsLoaded(allConversations);
      
      // Auto-hide success message after celebration
      setTimeout(() => setShowSuccess(false), 5000);

    } catch (error) {
      console.error('Failed to process zip files:', error);
      onError?.(error instanceof Error ? error.message : 'Failed to process zip files');
    } finally {
      setIsProcessing(false);
      setUploadStatus(null);
    }
  };

  // 🎨 PROGRESS VISUALIZATION
  const ProgressDisplay = () => {
    if (!uploadStatus) return null;

    const progress = uploadStatus.total > 0 ? (uploadStatus.processed / uploadStatus.total) * 100 : 0;

    return (
      <div className="mt-6 space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Processing conversations...</span>
            <span className="text-blue-600 font-medium">
              {uploadStatus.processed} / {uploadStatus.total}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Current File */}
        {uploadStatus.currentFile && (
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            <span>Reading: {uploadStatus.currentFile}</span>
          </div>
        )}

        {/* Completed Files */}
        {completedFiles.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-green-700">Completed:</h4>
            <div className="space-y-1">
              {completedFiles.map((filename, index) => (
                <div key={index} className="flex items-center space-x-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>{filename}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Errors */}
        {uploadStatus.errors.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-red-700">Issues:</h4>
            <div className="space-y-1">
              {uploadStatus.errors.map((error, index) => (
                <div key={index} className="flex items-center space-x-2 text-sm text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 🎊 SUCCESS CELEBRATION
  const SuccessDisplay = () => {
    if (!showSuccess) return null;

    return (
      <div className="mt-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-green-900 flex items-center space-x-2">
              <span>Conversations Loaded Successfully!</span>
              <Sparkles className="h-5 w-5 text-yellow-500" />
            </h3>
            <p className="text-green-700 mt-1">
              Your AI conversation history is now searchable! Head to the search tab to explore your patterns.
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <div 
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
          isDragging 
            ? 'border-blue-400 bg-blue-50 scale-102' 
            : isProcessing
            ? 'border-purple-300 bg-purple-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Upload Icon & Animation */}
        <div className="mb-6">
          {isProcessing ? (
            <Brain className="h-16 w-16 text-purple-500 mx-auto animate-pulse" />
          ) : (
            <div className="relative">
              <FileArchive className={`h-16 w-16 mx-auto transition-colors ${
                isDragging ? 'text-blue-500' : 'text-gray-400'
              }`} />
              {isDragging && (
                <Zap className="h-8 w-8 text-yellow-500 absolute -top-2 -right-2 animate-bounce" />
              )}
            </div>
          )}
        </div>

        {/* Upload Text */}
        <div className="space-y-3">
          <h3 className={`text-xl font-semibold ${
            isProcessing ? 'text-purple-700' : isDragging ? 'text-blue-700' : 'text-gray-700'
          }`}>
            {isProcessing ? 'Processing Your Conversations...' :
             isDragging ? 'Drop Your Zip File Here!' :
             'Upload Your AI Conversation Archive'}
          </h3>
          
          <p className={`text-sm ${
            isProcessing ? 'text-purple-600' : isDragging ? 'text-blue-600' : 'text-gray-500'
          }`}>
            {isProcessing ? 'Extracting insights from your AI conversations' :
             isDragging ? 'Release to start the magic!' :
             'Drop a .zip file containing your ChatGPT, Claude, or other AI exports'}
          </p>
        </div>

        {/* File Input */}
        {!isProcessing && (
          <>
            <input 
              type="file" 
              accept=".zip"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              id="zip-file-upload"
              disabled={isProcessing}
            />
            <label 
              htmlFor="zip-file-upload"
              className={`mt-6 inline-flex items-center space-x-2 px-6 py-3 rounded-lg font-medium cursor-pointer transition-colors ${
                isDragging 
                  ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <Upload className="h-5 w-5" />
              <span>Choose Zip File</span>
            </label>
          </>
        )}

        {/* Processing Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-white bg-opacity-90 rounded-xl flex items-center justify-center">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500 mx-auto" />
              <p className="text-purple-700 font-medium">
                Unleashing your conversation insights...
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Format Support Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Supported Formats:</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-blue-800">ChatGPT JSON</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-blue-800">Claude Exports</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-blue-800">Gemini/Bard</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <span className="text-blue-800">Auto-detect</span>
          </div>
        </div>
      </div>

      {/* Progress Display */}
      <ProgressDisplay />

      {/* Success Display */}
      <SuccessDisplay />
    </div>
  );
};

export default ZipFileUploader;