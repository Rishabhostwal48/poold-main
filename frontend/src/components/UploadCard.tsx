/**
 * CV Upload component with drag-and-drop functionality
 * Supports PDF and DOCX files with progress indication
 */

import React, { useCallback, useState } from 'react';
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface UploadCardProps {
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
  isProcessing: boolean;
  selectedFile: File | null;
  error?: string;
  success?: boolean;
}

export function UploadCard({ 
  onFileSelect, 
  onFileRemove, 
  isProcessing, 
  selectedFile, 
  error, 
  success 
}: UploadCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const validFile = files.find(file => 
      file.type === 'application/pdf' || 
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    
    if (validFile) {
      onFileSelect(validFile);
    }
  }, [onFileSelect]);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  }, [onFileSelect]);
  
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  return (
    <Card className="bg-gradient-card shadow-soft border-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Upload CV/Resume
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!selectedFile ? (
          <div
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-smooth
              ${isDragging 
                ? 'border-primary bg-primary/5 scale-[1.02]' 
                : 'border-border hover:border-primary/50 hover:bg-primary/5'
              }
            `}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload className={`mx-auto h-12 w-12 mb-4 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
            <div className="space-y-2">
              <p className="text-lg font-medium">
                {isDragging ? 'Drop your CV here' : 'Drag & drop your CV'}
              </p>
              <p className="text-sm text-muted-foreground">
                Supports PDF and DOCX files (max 20MB)
              </p>
              <div className="pt-2">
                <Button variant="outline" asChild>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf,.docx"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                    Browse Files
                  </label>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg border">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium text-sm">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {success && <CheckCircle className="h-5 w-5 text-success" />}
                {!isProcessing && !success && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onFileRemove}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            
            {isProcessing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Processing CV...</span>
                  <Badge variant="secondary" className="animate-pulse">
                    Analyzing
                  </Badge>
                </div>
                <Progress value={85} className="h-2" />
              </div>
            )}
          </div>
        )}
        
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {success && !error && (
          <Alert className="bg-emerald-50 border-emerald-200">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-emerald-700">
              CV successfully processed and analyzed
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}