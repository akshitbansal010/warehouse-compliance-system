import React, { useState, useCallback, useRef } from 'react';
import axios from 'axios';

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

interface UploadedFile {
  id: number;
  title: string;
  original_filename: string;
  status: string;
  created_at: string;
  file_path: string;
}

interface AIProcessingStatus {
  status: 'idle' | 'processing' | 'completed' | 'error';
  message: string;
  progress: number;
}

const RoutingGuideUpload: React.FC = () => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [aiProcessingStatus, setAIProcessingStatus] = useState<AIProcessingStatus>({
    status: 'idle',
    message: '',
    progress: 0
  });
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
        setTitle(file.name.split('.')[0]);
      }
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
        setTitle(file.name.split('.')[0]);
      }
    }
  };

  const validateFile = (file: File): boolean => {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type)) {
      alert('Please upload a PDF, DOC, DOCX, or TXT file.');
      return false;
    }

    if (file.size > maxSize) {
      alert('File size must be less than 10MB.');
      return false;
    }

    return true;
  };

  const uploadFile = async () => {
    if (!selectedFile || !title.trim()) {
      alert('Please select a file and enter a title.');
      return;
    }

    setIsUploading(true);
    setUploadProgress({ loaded: 0, total: selectedFile.size, percentage: 0 });
    setAIProcessingStatus({ status: 'idle', message: 'Preparing upload...', progress: 0 });

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', title);
    if (description) {
      formData.append('description', description);
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/routing-guides/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
        onUploadProgress: (progressEvent) => {
          const loaded = progressEvent.loaded || 0;
          const total = progressEvent.total || selectedFile.size;
          const percentage = Math.round((loaded * 100) / total);
          
          setUploadProgress({
            loaded,
            total,
            percentage
          });
        }
      });

      // Upload completed, start AI processing simulation
      setAIProcessingStatus({
        status: 'processing',
        message: 'Processing document with AI...',
        progress: 0
      });

      // Simulate AI processing progress
      const processingInterval = setInterval(() => {
        setAIProcessingStatus(prev => {
          const newProgress = prev.progress + 10;
          if (newProgress >= 100) {
            clearInterval(processingInterval);
            return {
              status: 'completed',
              message: 'AI processing completed successfully!',
              progress: 100
            };
          }
          return {
            ...prev,
            progress: newProgress,
            message: `Processing document... ${newProgress}%`
          };
        });
      }, 500);

      // Add uploaded file to list
      setUploadedFiles(prev => [response.data, ...prev]);
      
      // Reset form
      setSelectedFile(null);
      setTitle('');
      setDescription('');
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error: any) {
      console.error('Upload error:', error);
      setAIProcessingStatus({
        status: 'error',
        message: error.response?.data?.detail || 'Upload failed. Please try again.',
        progress: 0
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getFileIcon = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return (
          <svg className="h-8 w-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
        );
      case 'doc':
      case 'docx':
        return (
          <svg className="h-8 w-8 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="h-8 w-8 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Upload Routing Guide</h1>
        <p className="text-gray-600">Upload and process routing guide documents with AI-powered content extraction.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Section */}
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Document Upload</h2>
            
            {/* File Input Fields */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="form-label">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="form-input"
                  placeholder="Enter routing guide title"
                  required
                />
              </div>
              
              <div>
                <label className="form-label">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="form-input"
                  rows={3}
                  placeholder="Optional description of the routing guide"
                />
              </div>
            </div>

            {/* Drag and Drop Area */}
            <div
              className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                isDragOver
                  ? 'border-primary-500 bg-primary-50'
                  : selectedFile
                  ? 'border-success-500 bg-success-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept=".pdf,.doc,.docx,.txt"
              />
              
              {selectedFile ? (
                <div className="flex items-center justify-center space-x-3">
                  {getFileIcon(selectedFile.name)}
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
              ) : (
                <div>
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div className="mt-4">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium text-primary-600">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500 mt-1">PDF, DOC, DOCX, TXT up to 10MB</p>
                  </div>
                </div>
              )}
            </div>

            {/* Upload Button */}
            <div className="mt-6">
              <button
                onClick={uploadFile}
                disabled={!selectedFile || !title.trim() || isUploading}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <div className="flex items-center justify-center">
                    <div className="loading-spinner mr-2"></div>
                    Uploading...
                  </div>
                ) : (
                  'Upload Routing Guide'
                )}
              </button>
            </div>
          </div>

          {/* Progress Section */}
          {(uploadProgress || aiProcessingStatus.status !== 'idle') && (
            <div className="card p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Processing Status</h3>
              
              {/* Upload Progress */}
              {uploadProgress && (
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-700 mb-2">
                    <span>Upload Progress</span>
                    <span>{uploadProgress.percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress.percentage}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* AI Processing Status */}
              {aiProcessingStatus.status !== 'idle' && (
                <div>
                  <div className="flex items-center mb-2">
                    {aiProcessingStatus.status === 'processing' && (
                      <div className="loading-spinner mr-2"></div>
                    )}
                    {aiProcessingStatus.status === 'completed' && (
                      <svg className="h-5 w-5 text-success-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                    {aiProcessingStatus.status === 'error' && (
                      <svg className="h-5 w-5 text-danger-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span className={`text-sm font-medium ${
                      aiProcessingStatus.status === 'completed' ? 'text-success-700' :
                      aiProcessingStatus.status === 'error' ? 'text-danger-700' :
                      'text-gray-700'
                    }`}>
                      AI Processing
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-2">{aiProcessingStatus.message}</p>
                  
                  {aiProcessingStatus.status === 'processing' && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${aiProcessingStatus.progress}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recent Uploads */}
        <div className="card p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Uploads</h2>
          
          {uploadedFiles.length > 0 ? (
            <div className="space-y-3">
              {uploadedFiles.slice(0, 5).map((file) => (
                <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getFileIcon(file.original_filename)}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{file.title}</p>
                      <p className="text-xs text-gray-500">{file.original_filename}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`status-badge ${
                      file.status === 'active' ? 'status-success' :
                      file.status === 'processing' ? 'status-warning' :
                      file.status === 'error' ? 'status-danger' :
                      'status-info'
                    }`}>
                      {file.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="mt-2 text-sm text-gray-500">No routing guides uploaded yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoutingGuideUpload;
