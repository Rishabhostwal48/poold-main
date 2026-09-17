import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const displayName = (user?.user_metadata as any)?.full_name || (user?.user_metadata as any)?.name || '';
  const email = user?.email || '';

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast({ title: 'Password too short', description: 'Password must be at least 8 characters', duration: 3000 });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Passwords do not match', description: 'Please make sure both fields match', duration: 3000 });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: 'Password updated', description: 'Your password was changed successfully' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Could not change password', duration: 4000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm block text-muted-foreground">Name</label>
                <Input value={displayName} readOnly />
              </div>

              <div>
                <label className="text-sm block text-muted-foreground">Email</label>
                <Input value={email} readOnly />
              </div>

              <form onSubmit={handleChangePassword} className="space-y-3">
                <div>
                  <label className="text-sm block text-muted-foreground">New password</label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" />
                </div>

                <div>
                  <label className="text-sm block text-muted-foreground">Confirm password</label>
                  <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" />
                </div>

                <div className="flex items-center gap-3">
                  <Button type="submit" className="bg-gradient-hero" disabled={loading}>{loading ? 'Saving...' : 'Change password'}</Button>
                  <Button variant="outline" onClick={() => navigate('/')}>Back to home</Button>
                </div>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
