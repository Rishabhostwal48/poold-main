import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Briefcase, MapPin, DollarSign, Trash2, Edit } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { UserMenu } from '@/components/UserMenu';

interface JobPosting {
  id: string;
  title: string;
  company_name: string | null;
  description: string | null;
  requirements: string | null;
  location: string | null;
  salary_range: string | null;
  employment_type: string | null;
  status: string;
  created_at: string;
}

export default function JobPostings() {
  const navigate = useNavigate();
  const { hasRole, loading: rolesLoading } = useUserRole();
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    company_name: '',
    description: '',
    requirements: '',
    location: '',
    salary_range: '',
    employment_type: 'full-time',
    status: 'active'
  });

  useEffect(() => {
    if (!rolesLoading && !hasRole('interviewer')) {
      toast.error('Access denied. Interviewer role required.');
      navigate('/');
      return;
    }
    if (!rolesLoading) {
      fetchJobPostings();
    }
  }, [rolesLoading, hasRole, navigate]);

  const fetchJobPostings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('job_postings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJobPostings(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch job postings');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.description) {
      toast.error('Please fill in required fields');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (editingId) {
        const { error } = await supabase
          .from('job_postings')
          .update(formData)
          .eq('id', editingId)
          .eq('user_id', user.id);

        if (error) throw error;
        toast.success('Job posting updated successfully');
      } else {
        const { error } = await supabase
          .from('job_postings')
          .insert([{ ...formData, user_id: user.id }]);

        if (error) throw error;
        toast.success('Job posting created successfully');
      }

      resetForm();
      fetchJobPostings();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save job posting');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (job: JobPosting) => {
    setFormData({
      title: job.title,
      company_name: job.company_name || '',
      description: job.description || '',
      requirements: job.requirements || '',
      location: job.location || '',
      salary_range: job.salary_range || '',
      employment_type: job.employment_type || 'full-time',
      status: job.status
    });
    setEditingId(job.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this job posting?')) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('job_postings')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success('Job posting deleted successfully');
      fetchJobPostings();
    } catch (error: any) {
      toast.error('Failed to delete job posting');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      company_name: '',
      description: '',
      requirements: '',
      location: '',
      salary_range: '',
      employment_type: 'full-time',
      status: 'active'
    });
    setEditingId(null);
    setShowForm(false);
  };

  if (rolesLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto max-w-6xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Job Postings</h1>
            <p className="text-muted-foreground">
              Manage job descriptions and required skills
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                resetForm();
                setShowForm(!showForm);
              }}
              className="bg-gradient-hero"
            >
              <Plus className="w-4 h-4 mr-2" />
              {showForm ? 'Cancel' : 'New Job Posting'}
            </Button>
            <UserMenu />
          </div>
        </div>

        {showForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>{editingId ? 'Edit Job Posting' : 'Create New Job Posting'}</CardTitle>
              <CardDescription>Fill in the details for the job position</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Job Title *</Label>
                    <Input
                      id="title"
                      placeholder="e.g. Senior Software Engineer"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Company Name</Label>
                    <Input
                      id="company_name"
                      placeholder="e.g. Tech Corp"
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Job Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the role, responsibilities, and what the candidate will be doing..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={6}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="requirements">Required Skills & Qualifications</Label>
                  <Textarea
                    id="requirements"
                    placeholder="List the required skills, experience, education, certifications, etc..."
                    value={formData.requirements}
                    onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                    rows={6}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      placeholder="e.g. New York, NY or Remote"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="salary_range">Salary Range</Label>
                    <Input
                      id="salary_range"
                      placeholder="e.g. $100k - $150k"
                      value={formData.salary_range}
                      onChange={(e) => setFormData({ ...formData, salary_range: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="employment_type">Employment Type</Label>
                    <Select
                      value={formData.employment_type}
                      onValueChange={(value) => setFormData({ ...formData, employment_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full-time">Full-time</SelectItem>
                        <SelectItem value="part-time">Part-time</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="internship">Internship</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Saving...' : editingId ? 'Update Job Posting' : 'Create Job Posting'}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4">
          {jobPostings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Briefcase className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No job postings yet. Create your first one!</p>
              </CardContent>
            </Card>
          ) : (
            jobPostings.map((job) => (
              <Card key={job.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-2xl">{job.title}</CardTitle>
                        <Badge variant={job.status === 'active' ? 'default' : 'secondary'}>
                          {job.status}
                        </Badge>
                      </div>
                      {job.company_name && (
                        <p className="text-muted-foreground">{job.company_name}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(job)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(job.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    {job.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {job.location}
                      </div>
                    )}
                    {job.salary_range && (
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        {job.salary_range}
                      </div>
                    )}
                    {job.employment_type && (
                      <Badge variant="outline">{job.employment_type}</Badge>
                    )}
                  </div>

                  {job.description && (
                    <div>
                      <h4 className="font-semibold mb-2">Description</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {job.description}
                      </p>
                    </div>
                  )}

                  {job.requirements && (
                    <div>
                      <h4 className="font-semibold mb-2">Required Skills & Qualifications</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {job.requirements}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
