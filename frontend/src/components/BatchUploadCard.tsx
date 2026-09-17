import React, { useCallback, useState } from 'react';
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ProcessedFile {
  file: File;
  status: 'pending' | 'processing' | 'success' | 'error';
  result?: any;
  error?: string;
}

interface BatchUploadCardProps {
  onFilesProcess: (files: File[]) => Promise<void>;
  isProcessing: boolean;
  processedFiles: ProcessedFile[];
  onClearFiles: () => void;
}

export function BatchUploadCard({ 
  onFilesProcess, 
  isProcessing,
  processedFiles,
  onClearFiles
}: BatchUploadCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type === 'application/pdf' || 
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    
    if (files.length > 0) {
      setSelectedFiles(files);
    }
  }, []);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedFiles(files);
    }
  }, []);

  const handleProcessFiles = async () => {
    if (selectedFiles.length > 0) {
      await onFilesProcess(selectedFiles);
    }
  };

  const handleClear = () => {
    setSelectedFiles([]);
    onClearFiles();
  };
  
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const successCount = processedFiles.filter(f => f.status === 'success').length;
  const errorCount = processedFiles.filter(f => f.status === 'error').length;
  const processingCount = processedFiles.filter(f => f.status === 'processing').length;
  
  return (
    <Card className="bg-gradient-card shadow-soft border-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Batch CV Upload
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={`
            border-2 border-dashed rounded-lg p-6 text-center transition-smooth
            ${isDragging 
              ? 'border-primary bg-primary/5 scale-[1.02]' 
              : 'border-border hover:border-primary/50 hover:bg-primary/5'
            }
          `}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Upload className={`mx-auto h-10 w-10 mb-3 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
          <div className="space-y-2">
            <p className="font-medium">
              {isDragging ? 'Drop multiple CVs here' : 'Select multiple CVs to process'}
            </p>
            <p className="text-sm text-muted-foreground">
              Supports PDF and DOCX files (max 20MB each)
            </p>
            <div className="pt-2 flex gap-2 justify-center">
              <Button variant="outline" asChild>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".pdf,.docx"
                    multiple
                    onChange={handleFileInput}
                    className="hidden"
                  />
                  Browse Files
                </label>
              </Button>
              {selectedFiles.length > 0 && (
                <Button onClick={handleProcessFiles} disabled={isProcessing}>
                  Process {selectedFiles.length} Files
                </Button>
              )}
            </div>
          </div>
        </div>

        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Selected Files ({selectedFiles.length})</h4>
              <Button variant="ghost" size="sm" onClick={handleClear}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-secondary/30 rounded text-sm">
                  <span className="truncate">{file.name}</span>
                  <span className="text-muted-foreground">{formatFileSize(file.size)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {processedFiles.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Processing Results</h4>
              <div className="flex gap-2">
                {successCount > 0 && (
                  <Badge variant="default" className="bg-success text-success-foreground">
                    ✓ {successCount}
                  </Badge>
                )}
                {processingCount > 0 && (
                  <Badge variant="secondary" className="animate-pulse">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    {processingCount}
                  </Badge>
                )}
                {errorCount > 0 && (
                  <Badge variant="destructive">
                    ✗ {errorCount}
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="max-h-40 overflow-y-auto space-y-2">
              {processedFiles.map((processedFile, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-secondary/20 rounded">
                  <div className="flex items-center gap-3">
                    {processedFile.status === 'success' && <CheckCircle className="h-4 w-4 text-success" />}
                    {processedFile.status === 'processing' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                    {processedFile.status === 'error' && <AlertCircle className="h-4 w-4 text-destructive" />}
                    <div>
                      <p className="font-medium text-sm">{processedFile.file.name}</p>
                      {processedFile.error && (
                        <p className="text-xs text-destructive">{processedFile.error}</p>
                      )}
                    </div>
                  </div>
                  <Badge 
                    variant={processedFile.status === 'success' ? 'default' : 
                             processedFile.status === 'error' ? 'destructive' : 'secondary'}
                  >
                    {processedFile.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Processing CVs...</span>
              <Badge variant="secondary" className="animate-pulse">
                Analyzing
              </Badge>
            </div>
            <Progress value={Math.round((successCount + errorCount) / processedFiles.length * 100)} className="h-2" />
          </div>
        )}

        {successCount > 0 && (
          <Alert className="bg-emerald-50 border-emerald-200">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-emerald-700">
              Successfully processed {successCount} CV{successCount > 1 ? 's' : ''}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}