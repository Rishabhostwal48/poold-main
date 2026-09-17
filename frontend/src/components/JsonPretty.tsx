/**
 * JSON Pretty display component with toggle between raw and formatted views
 * Provides syntax highlighting and collapsible structure
 */

import React, { useState } from 'react';
import { Eye, Code, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface JsonPrettyProps {
  data: any;
  title: string;
  className?: string;
}

export function JsonPretty({ data, title, className = "" }: JsonPrettyProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      toast({
        title: "Copied to clipboard",
        description: `${title} data copied successfully`,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
      });
    }
  };
  
  const renderValue = (value: any, key?: string, depth = 0): React.ReactNode => {
    const indent = '  '.repeat(depth);
    
    if (value === null) {
      return <span className="text-muted-foreground">null</span>;
    }
    
    if (typeof value === 'boolean') {
      return <span className="text-accent">{value.toString()}</span>;
    }
    
    if (typeof value === 'number') {
      return <span className="text-success">{value}</span>;
    }
    
    if (typeof value === 'string') {
      return <span className="text-primary">"{value}"</span>;
    }
    
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-muted-foreground">[]</span>;
      }
      
      return (
        <div>
          <span className="text-muted-foreground">[</span>
          {value.map((item, index) => (
            <div key={index} className="ml-4">
              {renderValue(item, undefined, depth + 1)}
              {index < value.length - 1 && <span className="text-muted-foreground">,</span>}
            </div>
          ))}
          <span className="text-muted-foreground">]</span>
        </div>
      );
    }
    
    if (typeof value === 'object') {
      const entries = Object.entries(value);
      if (entries.length === 0) {
        return <span className="text-muted-foreground">{}</span>;
      }
      
      return (
        <div>
          <span className="text-muted-foreground">{'{'}</span>
          {entries.map(([objKey, objValue], index) => (
            <div key={objKey} className="ml-4">
              <span className="text-foreground font-medium">"{objKey}"</span>
              <span className="text-muted-foreground">: </span>
              {renderValue(objValue, objKey, depth + 1)}
              {index < entries.length - 1 && <span className="text-muted-foreground">,</span>}
            </div>
          ))}
          <span className="text-muted-foreground">{'}'}</span>
        </div>
      );
    }
    
    return <span>{String(value)}</span>;
  };
  
  const renderPrettyField = (key: string, value: any) => {
    if (Array.isArray(value) && value.length > 0) {
      return (
        <div className="space-y-2">
          <h4 className="font-medium text-sm text-foreground capitalize">
            {key.replace(/_/g, ' ')}
            <Badge variant="secondary" className="ml-2 text-xs">
              {value.length}
            </Badge>
          </h4>
          <div className="space-y-1 ml-2">
            {value.map((item, index) => (
              <div key={index} className="text-sm">
                {typeof item === 'string' ? (
                  <span className="text-muted-foreground">• {item}</span>
                ) : (
                  <div className="p-2 bg-secondary/30 rounded border-l-2 border-primary/30">
                    {Object.entries(item).map(([subKey, subValue]) => (
                      <div key={subKey} className="mb-1">
                        <span className="font-medium text-xs text-foreground">
                          {subKey}: 
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">
                          {Array.isArray(subValue) ? subValue.join(', ') : String(subValue)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    if (typeof value === 'object' && value !== null) {
      return (
        <div className="space-y-2">
          <h4 className="font-medium text-sm text-foreground capitalize">
            {key.replace(/_/g, ' ')}
          </h4>
          <div className="ml-2 space-y-1">
            {Object.entries(value).map(([subKey, subValue]) => (
              <div key={subKey} className="text-sm">
                <span className="font-medium text-foreground text-xs">
                  {subKey}: 
                </span>
                <span className="text-muted-foreground ml-1 text-xs">
                  {Array.isArray(subValue) ? subValue.join(', ') : String(subValue)}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    return (
      <div className="space-y-1">
        <h4 className="font-medium text-sm text-foreground capitalize">
          {key.replace(/_/g, ' ')}
        </h4>
        <p className="text-sm text-muted-foreground ml-2">
          {String(value)}
        </p>
      </div>
    );
  };
  
  if (!data) {
    return (
      <div className={`p-6 text-center text-muted-foreground ${className}`}>
        <Code className="mx-auto h-12 w-12 mb-2 opacity-50" />
        <p>No data available</p>
      </div>
    );
  }
  
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">{title}</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="transition-smooth"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </>
          )}
        </Button>
      </div>
      
      <Tabs defaultValue="pretty" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pretty" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Structured
          </TabsTrigger>
          <TabsTrigger value="json" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            Raw JSON
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="pretty" className="mt-4">
          <div className="space-y-4 p-4 bg-secondary/20 rounded-lg border">
            {Object.entries(data).map(([key, value]) => (
              <div key={key} className="pb-3 last:pb-0 border-b last:border-b-0 border-border/30">
                {renderPrettyField(key, value)}
              </div>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="json" className="mt-4">
          <div className="p-4 bg-secondary/20 rounded-lg border font-mono text-sm overflow-auto max-h-96">
            {renderValue(data)}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}