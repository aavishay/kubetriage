import React, { useState } from 'react';
import { Organization } from '../types';
import { Building, Plus, Search, MoreHorizontal, ShieldCheck, Users, Calendar, X, Globe } from 'lucide-react';

interface OrganizationViewProps {
  organizations: Organization[];
  onAddOrganization: (org: Organization) => void;
  isDarkMode?: boolean;
}

export const OrganizationView: React.FC<OrganizationViewProps> = ({ organizations, onAddOrganization, isDarkMode = true }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // New Org Form State
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newPlan, setNewPlan] = useState<Organization['plan']>('Free');
  const [newRegion, setNewRegion] = useState('US');

  const filteredOrgs = organizations.filter(org => 
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    org.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newSlug) return;

    const newOrg: Organization = {
      id: `org-${Date.now()}`,
      name: newName,
      slug: newSlug.toLowerCase().replace(/\s+/g, '-'),
      plan: newPlan,
      status: 'Active',
      createdAt: new Date().toISOString().split('T')[0],
      region: newRegion
    };

    onAddOrganization(newOrg);
    setIsModalOpen(false);
    
    // Reset form
    setNewName('');
    setNewSlug('');
    setNewPlan('Free');
    setNewRegion('US');
  };

  const getPlanColor = (plan: string) => {
    switch(plan) {
      case 'Enterprise': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'Team': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      default: return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700';
    }
  };

  return (
    <div className="flex flex-col gap-6 h-auto md:h-[calc(100vh-140px)]">
      {/* Header Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Building className="w-6 h-6 text-indigo-500" />
            Organization Management
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Manage multi-tenant organizations, plans, and access controls.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-medium transition-all shadow-lg shadow-indigo-500/20"
        >
          <Plus className="w-4 h-4" />
          Create Organization
        </button>
      </div>

      {/* Main Content */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col flex-1 overflow-hidden shadow-sm min-h-[500px] md:min-h-0">
        
        {/* Toolbar */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col sm:flex-row gap-4 justify-between items-center shrink-0">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Search organizations..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
            />
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            Showing {filteredOrgs.length} of {organizations.length} organizations
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full text-left">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider sticky top-0 z-10 backdrop-blur-sm">
              <tr>
                <th className="px-6 py-3 border-b border-zinc-200 dark:border-zinc-800">Organization Name</th>
                <th className="px-6 py-3 border-b border-zinc-200 dark:border-zinc-800">Subscription Plan</th>
                <th className="px-6 py-3 border-b border-zinc-200 dark:border-zinc-800">Region</th>
                <th className="px-6 py-3 border-b border-zinc-200 dark:border-zinc-800">Status</th>
                <th className="px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 text-right">Created</th>
                <th className="px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
              {filteredOrgs.map((org) => (
                <tr key={org.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                        {org.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-zinc-900 dark:text-white">{org.name}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {org.slug}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getPlanColor(org.plan)}`}>
                       <ShieldCheck className="w-3 h-3" />
                       {org.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-2">
                       <Globe className="w-4 h-4 text-zinc-400" />
                       {org.region}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${org.status === 'Active' ? 'bg-emerald-500' : 'bg-zinc-400'}`}></span>
                      <span className={`text-zinc-700 dark:text-zinc-300 font-medium ${org.status === 'Active' ? '' : 'opacity-60'}`}>
                        {org.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-zinc-500 dark:text-zinc-400 font-mono text-xs">
                     <div className="flex items-center justify-end gap-1">
                        <Calendar className="w-3 h-3" />
                        {org.createdAt}
                     </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredOrgs.length === 0 && (
             <div className="p-12 text-center text-zinc-500 dark:text-zinc-400 flex flex-col items-center">
                <Building className="w-12 h-12 mb-3 opacity-20" />
                <p>No organizations found matching "{searchTerm}"</p>
             </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden relative animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-950">
               <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Building className="w-4 h-4 text-indigo-500" /> Create New Organization
               </h3>
               <button 
                 onClick={() => setIsModalOpen(false)}
                 className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
               >
                  <X className="w-4 h-4" />
               </button>
            </div>
            
            <form onSubmit={handleCreate} className="p-6 space-y-4">
               <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1.5 col-span-2">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Organization Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Acme Industries"
                        value={newName}
                        onChange={(e) => {
                            setNewName(e.target.value);
                            // Auto-generate slug
                            setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));
                        }}
                        className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                        autoFocus
                        required
                      />
                   </div>
                   
                   <div className="space-y-1.5 col-span-2">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">URL Slug</label>
                      <div className="flex items-center">
                          <span className="bg-zinc-100 dark:bg-zinc-800 border border-r-0 border-zinc-200 dark:border-zinc-700 text-zinc-500 text-xs px-3 py-2 rounded-l-lg">
                              app.kubeoptima.io/
                          </span>
                          <input 
                            type="text" 
                            placeholder="acme-industries"
                            value={newSlug}
                            onChange={(e) => setNewSlug(e.target.value)}
                            className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-r-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono"
                            required
                          />
                      </div>
                   </div>

                   <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Plan Tier</label>
                      <select 
                        value={newPlan}
                        onChange={(e) => setNewPlan(e.target.value as any)}
                        className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer"
                      >
                         <option value="Free">Free</option>
                         <option value="Team">Team</option>
                         <option value="Enterprise">Enterprise</option>
                      </select>
                   </div>
                   
                   <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Region</label>
                      <select 
                        value={newRegion}
                        onChange={(e) => setNewRegion(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer"
                      >
                         <option value="US">United States (US)</option>
                         <option value="EU">Europe (EU)</option>
                         <option value="APAC">Asia Pacific (APAC)</option>
                      </select>
                   </div>
               </div>
               
               <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                  >
                     Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-indigo-500/20 transition-all"
                  >
                     Create Organization
                  </button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};