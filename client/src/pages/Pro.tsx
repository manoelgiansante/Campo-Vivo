import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Leaf, 
  Users, 
  FlaskConical,
  ChevronRight,
  Check,
  Sparkles,
  Map,
  BarChart3,
  Layers,
  Target,
  Cpu,
  Globe,
  FileText,
  Palette,
  TestTube,
  Brain,
  Eye,
  Tractor,
  LineChart,
  ScanLine,
  MapPin,
  ArrowLeft,
} from "lucide-react";
import { useLocation } from "wouter";

type TabType = "farmers" | "consultants" | "soil";

// Feature card data
const farmersFeatures = [
  {
    icon: Brain,
    title: "Obtenha análises de talhões com base em IA",
    description: "Use os resultados de nossa análise multitemporal do NDVI para mais de seis safras e entenda se seus campos têm zonas de produtividade estáveis. Obtenha mapas de relevo e de brilho do solo para descobrir os fatores limitantes dos seus talhões.",
    color: "from-green-500 to-emerald-600",
  },
  {
    icon: Target,
    title: "Crie prescrições em taxa variável em poucos cliques",
    description: "Crie recomendações de taxa variável para a semeadura, adubação e aplicação de defensivos com base nas melhores zonas de produtividade da categoria ou em imagem recente do NDVI.",
    color: "from-blue-500 to-cyan-600",
  },
  {
    icon: MapPin,
    title: "Crie mapas de prescrição para a amostragem de solo",
    description: "Nosso algoritmo analisa seus talhões e fornece zonas homogêneas ideais para a amostragem do solo, o que garante resultados mais confiáveis.",
    color: "from-purple-500 to-violet-600",
  },
  {
    icon: TestTube,
    title: "Realize testes de campo",
    description: "Use nossa tecnologia exclusiva para medir os resultados exatos de como a VRA funciona para você: crie testes com testemunhas integradas em mapas de prescrição.",
    color: "from-orange-500 to-amber-600",
  },
  {
    icon: Tractor,
    title: "Conecte-se ao maquinário para obter dados",
    description: "Configure facilmente a conexão ao John Deere Operations Center para importar seus talhões e exportar mapas de prescrição diretamente para o equipamento. Ou simplesmente carregue/baixe arquivos para outras marcas de maquinário.",
    color: "from-red-500 to-rose-600",
  },
  {
    icon: LineChart,
    title: "Analise os resultados de rendimento",
    description: "Ao final da safra, carregue os arquivos do seu maquinário e confira os dados de colheita para avaliar os resultados dos testes.",
    color: "from-teal-500 to-cyan-600",
  },
];

const consultantsFeatures = [
  {
    icon: Users,
    title: "Gerenciamento de clientes",
    description: "Crie e configure as contas dos seus clientes, depois, basta compartilhar o link com eles.",
    color: "from-blue-500 to-indigo-600",
  },
  {
    icon: Palette,
    title: "Marca corporativa",
    description: "Personalize a interface do aplicativo CampoVivo e os relatórios de campo em PDF com as cores e o logotipo da sua empresa.",
    color: "from-purple-500 to-pink-600",
  },
  {
    icon: TestTube,
    title: "Testes de campo para a verificação de hipóteses",
    description: "Planeje e realize testes de campo com seus clientes para confirmar suas recomendações de uma seleção de insumos e taxas de aplicações ideais.",
    color: "from-green-500 to-emerald-600",
  },
  {
    icon: Cpu,
    title: "Mapas de prescrição criados por IA que podem ser ajustados manualmente",
    description: "Crie recomendações de taxa variável para a semeadura, adubação e aplicação de defensivos com base nas melhores zonas de produtividade da categoria ou em imagem recente do NDVI.",
    color: "from-orange-500 to-amber-600",
  },
  {
    icon: ScanLine,
    title: "Reconhecimento automático de culturas prévias nos talhões dos clientes",
    description: "Com o reconhecimento por IA das culturas cultivadas anteriormente, é possível criar planos precisos de rotação de culturas específicas para o talhão.",
    color: "from-cyan-500 to-blue-600",
  },
  {
    icon: Globe,
    title: "Monitoramento remoto das lavouras",
    description: "Monitore os talhões dos seus clientes de qualquer lugar do mundo. Isso garante uma colaboração perfeita entre você e seus clientes usando nossos aplicativos Web e móvel.",
    color: "from-teal-500 to-green-600",
  },
];

const soilFeatures = [
  {
    icon: Layers,
    title: "Geração automatizada de zonas de amostragem de solo",
    description: "Baseado nas zonas de produtividade do seu talhão. Isso permite reduzir a quantidade de amostras sem perder qualidade.",
    color: "from-amber-500 to-orange-600",
  },
  {
    icon: FileText,
    title: "Carregue e visualize os resultados de análise de solo",
    description: "Forneça aos clientes relatórios de fácil compreensão da análise de solo. Adicione o logotipo da sua empresa a eles para dar um toque profissional.",
    color: "from-green-500 to-emerald-600",
  },
];

// Hero images/illustrations for each tab
const heroContent = {
  farmers: {
    title: "Atribua seus insumos sabiamente para aumentar a produtividade usando a VRA",
    image: "🌾",
    gradient: "from-green-500/20 to-emerald-500/20",
  },
  consultants: {
    title: "Forneça um serviço excepcional aos seus clientes e comprove as recomendações por meio de testes de campo",
    image: "👨‍💼",
    gradient: "from-blue-500/20 to-indigo-500/20",
  },
  soil: {
    title: "Crie mapas de prescrição automaticamente para a amostragem do solo",
    image: "🧪",
    gradient: "from-amber-500/20 to-orange-500/20",
  },
};

export default function Pro() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>("farmers");
  const [formData, setFormData] = useState({ name: "", phone: "" });

  const getFeatures = () => {
    switch (activeTab) {
      case "farmers":
        return farmersFeatures;
      case "consultants":
        return consultantsFeatures;
      case "soil":
        return soilFeatures;
    }
  };

  const getCtaText = () => {
    switch (activeTab) {
      case "farmers":
        return "Iniciar avaliação gratuita";
      case "consultants":
        return "Receber uma oferta";
      case "soil":
        return "Receber uma oferta";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implementar envio do formulário
    alert(`Obrigado ${formData.name}! Entraremos em contato pelo telefone ${formData.phone}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setLocation("/")}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
                  <Leaf className="h-6 w-6 text-white" />
                </div>
                <div>
                  <span className="text-xl font-bold text-gray-900">CampoVivo</span>
                  <span className="ml-2 text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white px-2 py-0.5 rounded-full">
                    PRO
                  </span>
                </div>
              </div>
            </div>
            <Button 
              onClick={() => setLocation("/dashboard")}
              className="bg-green-600 hover:bg-green-700"
            >
              Acessar Dashboard
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-50 via-white to-emerald-50" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-green-200 rounded-full blur-3xl opacity-30" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-200 rounded-full blur-3xl opacity-30" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center max-w-4xl mx-auto">
            {/* Version Badge */}
            <div className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-lg shadow-gray-200/50 mb-8">
              <span className="text-2xl font-bold text-gray-900">0.8</span>
              <span className="text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-1 rounded-full">
                PRO
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Ferramenta profissional para{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-600">
                melhores decisões
              </span>{" "}
              de agronomia
            </h1>
            
            <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
              Explore recursos aprimorados para a eficiência da sua lavoura
            </p>

            {/* Tabs */}
            <div className="inline-flex bg-gray-100 rounded-2xl p-1.5 mb-12">
              {[
                { id: "farmers" as TabType, label: "Para produtores", icon: Leaf },
                { id: "consultants" as TabType, label: "Para consultores", icon: Users },
                { id: "soil" as TabType, label: "Para análise do solo", icon: FlaskConical },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? "bg-white text-gray-900 shadow-lg"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Hero Card for selected tab */}
      <section className="relative -mt-8 mb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`bg-gradient-to-br ${heroContent[activeTab].gradient} rounded-3xl p-8 md:p-12 border border-white/50 shadow-xl`}>
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="text-8xl">{heroContent[activeTab].image}</div>
              <div className="text-center md:text-left">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                  {heroContent[activeTab].title}
                </h2>
                <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                  <span className="inline-flex items-center gap-1.5 text-sm text-gray-700 bg-white/70 px-3 py-1.5 rounded-full">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Tecnologia de ponta
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm text-gray-700 bg-white/70 px-3 py-1.5 rounded-full">
                    <Check className="h-4 w-4 text-green-500" />
                    Fácil de usar
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {getFeatures().map((feature, index) => (
              <div
                key={index}
                className="group bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:border-gray-200 transition-all duration-300"
              >
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* New Features Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Últimas Novidades
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Fique por dentro dos recursos mais recentes e melhorias
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                date: "Nov 2025",
                title: "Gerencie suas assinaturas com facilidade",
                description: "Visualize e acompanhe todas as suas assinaturas ativas diretamente na interface.",
                icon: BarChart3,
                color: "from-blue-500 to-indigo-600",
              },
              {
                date: "Set 2025",
                title: "Integração com BBLeap",
                description: "Transforme insights de satélite em decisões reais de pulverização em minutos.",
                icon: Target,
                color: "from-green-500 to-emerald-600",
              },
              {
                date: "Jul 2025",
                title: "Imagens de alta resolução Planet Labs",
                description: "Acesso a dados ainda mais precisos e atualizados para monitorar a saúde das culturas.",
                icon: Eye,
                color: "from-purple-500 to-violet-600",
              },
              {
                date: "Mai 2025",
                title: "Editar limites usando camadas de satélite",
                description: "Ajuste os limites dos talhões usando imagens de satélite ou camadas NDVI.",
                icon: Map,
                color: "from-orange-500 to-amber-600",
              },
              {
                date: "Mai 2025",
                title: "Exportação em massa de mapas",
                description: "Baixe Mapas de Produtividade, Zonas, Prescrição e Amostragem de Solo em lote.",
                icon: FileText,
                color: "from-teal-500 to-cyan-600",
              },
              {
                date: "Mar 2025",
                title: "Novos índices: NDMI, SMI, NDRE, MSAVI",
                description: "Visualize múltiplos índices vegetativos e compare com outras camadas.",
                icon: Layers,
                color: "from-red-500 to-rose-600",
              },
            ].map((item, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center`}>
                    <item.icon className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    {item.date}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-gray-600 text-sm">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-3xl p-8 md:p-12 text-center relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
            
            <div className="relative">
              {activeTab === "farmers" && (
                <div className="mb-6">
                  <span className="inline-block bg-white/20 text-white text-sm font-medium px-4 py-2 rounded-full">
                    Teste 3 talhões por 14 dias
                  </span>
                  <p className="text-green-100 text-sm mt-2">
                    Não é preciso inserir os dados do cartão de crédito
                  </p>
                </div>
              )}

              <h2 className="text-3xl md:text-4xl font-bold text-white mb-8">
                {activeTab === "farmers" 
                  ? "Comece sua avaliação gratuita" 
                  : "Entre em contato conosco"}
              </h2>

              <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-4">
                <Input
                  type="text"
                  placeholder="Seu nome"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 rounded-xl"
                  required
                />
                <Input
                  type="tel"
                  placeholder="Telefone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 rounded-xl"
                  required
                />
                <Button 
                  type="submit"
                  className="w-full h-12 bg-white text-green-700 hover:bg-green-50 font-semibold rounded-xl"
                >
                  {getCtaText()}
                  <ChevronRight className="h-5 w-5 ml-1" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Planos e Preços
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Escolha o plano ideal para suas necessidades
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Plan */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Gratuito</h3>
                <div className="text-4xl font-bold text-gray-900">R$ 0</div>
                <p className="text-gray-500 text-sm mt-1">para sempre</p>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "Até 5 talhões",
                  "Monitoramento NDVI",
                  "Dados climáticos",
                  "Notas de campo",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setLocation("/dashboard")}
              >
                Plano Atual
              </Button>
            </div>

            {/* Pro Plan */}
            <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl p-8 shadow-xl relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-amber-400 text-amber-900 text-xs font-bold px-3 py-1 rounded-full">
                  POPULAR
                </span>
              </div>
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-white mb-2">PRO</h3>
                <div className="text-4xl font-bold text-white">R$ 99</div>
                <p className="text-green-100 text-sm mt-1">por mês</p>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "Talhões ilimitados",
                  "Mapas de prescrição VRA",
                  "Zonas de produtividade IA",
                  "Análise de rendimento",
                  "Exportação de mapas",
                  "Suporte prioritário",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-white">
                    <Check className="h-4 w-4 text-green-300 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button className="w-full bg-white text-green-700 hover:bg-green-50">
                Começar Teste Grátis
              </Button>
            </div>

            {/* Enterprise Plan */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Enterprise</h3>
                <div className="text-4xl font-bold text-gray-900">Custom</div>
                <p className="text-gray-500 text-sm mt-1">sob consulta</p>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "Tudo do PRO",
                  "Gerenciamento de clientes",
                  "Marca corporativa",
                  "API dedicada",
                  "Treinamento personalizado",
                  "SLA garantido",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full">
                Falar com Vendas
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center">
                <Leaf className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold">CampoVivo</span>
            </div>
            
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <a href="#" className="hover:text-white transition-colors">Termos de Uso</a>
              <a href="#" className="hover:text-white transition-colors">Privacidade</a>
              <a href="#" className="hover:text-white transition-colors">Suporte</a>
            </div>
            
            <p className="text-sm text-gray-500">
              © 2025 CampoVivo. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
