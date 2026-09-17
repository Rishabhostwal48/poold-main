import { LogOut, Trash2, ArrowLeft } from 'lucide-react';
import { User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface UserMenuProps {
  showBackButton?: boolean;
}

export function UserMenu({ showBackButton = true }: UserMenuProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Logged out successfully');
      navigate('/auth');
    } catch (error: any) {
      toast.error('Error logging out: ' + error.message);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('No user found');
        return;
      }

      // Call edge function to delete user account
      // const { data, error } = await supabase.functions.invoke('delete-user-account', {
      //   body: { userId: user.id }
      // });
      let data,error;
      await fetch(`${import.meta.env.VITE_BACKEND_URL}/delete-user-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: { userId: user.id }
      }).then((res)=>res.json()).then((resData)=>{
        data=resData;
      }).catch((err)=>{
        error=err;
      })
      if (error) throw error;

      // Sign out after successful deletion
      await signOut();
      toast.success('Account deleted successfully');
      navigate('/auth');
    } catch (error: any) {
      toast.error('Error deleting account: ' + error.message);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/profile')}
      >
        <User className="w-4 h-4 mr-2" />
        Profile
      </Button>
      {showBackButton && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      )}
      
      <Button
        variant="outline"
        size="sm"
        onClick={handleLogout}
      >
        <LogOut className="w-4 h-4 mr-2" />
        Logout
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="destructive"
            size="sm"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Account
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              account and remove all your data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
