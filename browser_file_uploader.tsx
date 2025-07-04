const FileUploader: React.FC<{
  onConversationsLoaded: (conversations: Conversation[]) => void;
  onError: (error: string) => void;
}> = ({ onConversationsLoaded, onError }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<{
    total: number;
    processed: number;
    currentFile: string;
    errors: string[];
  }>({ total: 0, processed: 0, currentFile: '', errors: [] });

  // --- New helper: process ZIPs ---
  async function extractZipConversations(zipFile: File): Promise<Conversation[]> {
    const zip = await JSZip.loadAsync(zipFile);
    const convos: Conversation[] = [];
    const fileEntries = Object.values(zip.files).filter(file =>
      file.name.endsWith('.json') ||
      file.name.endsWith('.txt') ||
      file.name.endsWith('.md')
    );

    for (const file of fileEntries) {
      const text = await file.async('string');
      try {
        if (file.name.endsWith('.json')) {
          const data = JSON.parse(text);
          if (Array.isArray(data)) {
            data.forEach((conv, i) => {
              if (conv.mapping || conv.messages) {
                convos.push(normalizeChatGPTConversation(conv, i));
              }
            });
          } else if (data.mapping || data.messages) {
            convos.push(normalizeChatGPTConversation(data, 0));
          }
          if (data.conversation || data.messages) {
            convos.push(normalizeClaudeConversation(data));
          }
        } else {
          convos.push(parseTextConversation(text, file.name));
        }
      } catch (err) {
        // skip errors, keep going
      }
    }
    return convos;
  }

  // --- Updated processFiles: now with zip support ---
  const processFiles = async (files: File[]) => {
    const validFiles = files.filter(file =>
      file.name.endsWith('.json') ||
      file.name.endsWith('.txt') ||
      file.name.endsWith('.md') ||
      file.name.endsWith('.zip')
    );

    if (validFiles.length === 0) {
      onError('Please select .json, .txt, .md, or .zip files containing conversation exports');
      return;
    }

    setIsProcessing(true);
    setProcessingStatus({ total: validFiles.length, processed: 0, currentFile: '', errors: [] });

    const allConversations: Conversation[] = [];

    for (const file of validFiles) {
      setProcessingStatus(prev => ({ ...prev, currentFile: file.name }));
      try {
        let conversations: Conversation[] = [];
        if (file.name.endsWith('.zip')) {
          conversations = await extractZipConversations(file);
        } else {
          conversations = await processConversationFile(file);
        }
        allConversations.push(...conversations);
        setProcessingStatus(prev => ({ ...prev, processed: prev.processed + 1 }));
      } catch (error) {
        setProcessingStatus(prev => ({
          ...prev,
          errors: [...prev.errors, `${file.name}: ${error}`]
        }));
      }
    }

    setIsProcessing(false);

    if (allConversations.length > 0) {
      onConversationsLoaded(allConversations);
    } else {
      onError('No valid conversations found in the uploaded files');
    }
  };

  // --- Rest is unchanged ---
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
    processFiles(Array.from(e.dataTransfer.files));
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files));
    }
  }, []);

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

        <div className="space-y-3">
          <h3 className={`text-xl font-semibold ${
            isProcessing ? 'text-purple-700' : isDragging ? 'text-blue-700' : 'text-gray-700'
          }`}>
            {isProcessing ? 'Processing Your Conversations...' :
             isDragging ? 'Drop Your Files Here!' :
             'Upload Your AI Conversation Files'}
          </h3>
          <p className={`text-sm ${
            isProcessing ? 'text-purple-600' : isDragging ? 'text-blue-600' : 'text-gray-500'
          }`}>
            {isProcessing ? 'Extracting insights from your conversations' :
             isDragging ? 'Release to start the magic!' :
             'Drop .zip, .json, .txt, or .md files containing your ChatGPT, Claude, or other AI exports'}
          </p>
        </div>

        {!isProcessing && (
          <>
            <input
              type="file"
              accept=".zip,.json,.txt,.md"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              id="file-upload"
              disabled={isProcessing}
            />
            <label
              htmlFor="file-upload"
              className={`mt-6 inline-flex items-center space-x-2 px-6 py-3 rounded-lg font-medium cursor-pointer transition-colors ${
                isDragging
                  ? 'bg-blue-500 hover:bg-blue-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <Upload className="h-5 w-5" />
              <span>Choose Files</span>
            </label>
          </>
        )}
      </div>

      {/* Processing Progress */}
      {isProcessing && (
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Processing files...</span>
            <span className="text-blue-600 font-medium">
              {processingStatus.processed} / {processingStatus.total}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-300"
              style={{
                width: `${processingStatus.total > 0 ? (processingStatus.processed / processingStatus.total) * 100 : 0}%`
              }}
            />
          </div>
          {processingStatus.currentFile && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span>Reading: {processingStatus.currentFile}</span>
            </div>
          )}
        </div>
      )}

      {/* Format Support Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Supported Formats:</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-blue-800">ZIP (auto-extracts JSON/TXT/MD)</span>
          </div>
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
            <span className="text-blue-800">Text/Markdown</span>
          </div>
        </div>
      </div>
    </div>
  );
};
