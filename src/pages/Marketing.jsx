import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp } from 'lucide-react';

// Existing aba components (kept inline for Posts and LPs)
import AbaPosts from '@/components/marketing/AbaPosts';
import AbaLandingPages from '@/components/marketing/AbaLandingPages';
import AbaDashboardAgenda from '@/components/marketing/AbaDashboardAgenda';
import AbaLeadsFollowUp from '@/components/marketing/AbaLeadsFollowUp';
import AbaSocialSelling from '@/components/marketing/AbaSocialSelling';
import AbaInstagramCanais from '@/components/marketing/AbaInstagramCanais';
import AbaClubeDoLivro from '@/components/marketing/AbaClubeDoLivro';
import AbaMentoria from '@/components/marketing/AbaMentoria';

export default function Marketing() {
  const { data: posts = [] } = useQuery({ queryKey: ['posts-marketing'], queryFn: () => base44.entities.PostMarketing.list('-created_date') });
  const { data: lps = [] } = useQuery({ queryKey: ['landing-pages'], queryFn: () => base44.entities.LandingPage.list('-created_date') });
  const { data: leads = [] } = useQuery({ queryKey: ['leads-marketing'], queryFn: () => base44.entities.LeadMarketing.list('-created_date', 500) });

  const statsData = {
    postsPublicados: posts.filter(p => p.status === 'Publicado').length,
    totalLeads: lps.reduce((s, l) => s + (l.leads_gerados || 0), 0) + leads.filter(l => l.status === 'Fechado').length,
    lpsAtivas: lps.filter(l => l.status === 'Ativa').length,
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 p-3">
            <TrendingUp className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Marketing</h1>
            <p className="text-sm text-muted-foreground">Hub de Conteúdo, Vendas e Relacionamento</p>
          </div>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-white border border-rose-100 p-1 rounded-xl">
            <TabsTrigger value="dashboard" className="text-sm data-[state=active]:bg-rose-600 data-[state=active]:text-white rounded-lg px-3">📊 Dashboard</TabsTrigger>
            <TabsTrigger value="posts" className="text-sm data-[state=active]:bg-rose-600 data-[state=active]:text-white rounded-lg px-3">📸 Posts</TabsTrigger>
            <TabsTrigger value="landing-pages" className="text-sm data-[state=active]:bg-rose-600 data-[state=active]:text-white rounded-lg px-3">🌐 LPs</TabsTrigger>
            <TabsTrigger value="leads" className="text-sm data-[state=active]:bg-rose-600 data-[state=active]:text-white rounded-lg px-3">🎯 Leads</TabsTrigger>
            <TabsTrigger value="social" className="text-sm data-[state=active]:bg-rose-600 data-[state=active]:text-white rounded-lg px-3">🤝 Social Selling</TabsTrigger>
            <TabsTrigger value="instagram" className="text-sm data-[state=active]:bg-rose-600 data-[state=active]:text-white rounded-lg px-3">📱 Instagram</TabsTrigger>
            <TabsTrigger value="clube" className="text-sm data-[state=active]:bg-rose-600 data-[state=active]:text-white rounded-lg px-3">📚 Clube do Livro</TabsTrigger>
            <TabsTrigger value="mentoria" className="text-sm data-[state=active]:bg-rose-600 data-[state=active]:text-white rounded-lg px-3">🎓 Mentoria</TabsTrigger>
          </TabsList>

          <div className="bg-card border border-border rounded-xl p-4 md:p-6">
            <TabsContent value="dashboard"><AbaDashboardAgenda statsData={statsData} /></TabsContent>
            <TabsContent value="posts"><AbaPosts /></TabsContent>
            <TabsContent value="landing-pages"><AbaLandingPages /></TabsContent>
            <TabsContent value="leads"><AbaLeadsFollowUp /></TabsContent>
            <TabsContent value="social"><AbaSocialSelling /></TabsContent>
            <TabsContent value="instagram"><AbaInstagramCanais /></TabsContent>
            <TabsContent value="clube"><AbaClubeDoLivro /></TabsContent>
            <TabsContent value="mentoria"><AbaMentoria /></TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}