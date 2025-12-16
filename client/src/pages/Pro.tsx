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
  Zap,
  Shield,
  Wheat,
  Sun,
  CloudRain,
  TrendingUp,
  Award,
  Crown,
  Star,
} from "lucide-react";
import { useLocation } from "wouter";

type TabType = "growers" | "advisors" | "precision";

// Feature card data - focado em diferenciais únicos do Campo Vivo
const growersFeatures = [
  {
    icon: Brain,
    title: "Inteligência Agrícola Preditiva",
    description: "Nossa IA analisa padrões de 6+ safras e cruza com dados climáticos em tempo real para antecipar problemas antes que afetem sua produtividade.",
    color: "from-emerald-500 to-green-600",
  },
  {
    icon: Target,
    title: "Mapas de Aplicação Inteligente",
    description: "Gere recomendações precisas de taxa variável baseadas em zonas de manejo que consideram histórico, solo e microclima de cada talhão.",
    color: "from-sky-500 to-blue-600",
  },
  {
    icon: MapPin,
    title: "Amostragem de Solo Otimizada",
    description: "Algoritmo exclusivo identifica as zonas ideais para coleta, reduzindo custos sem perder precisão nos resultados.",
    color: "from-violet-500 to-purple-600",
  },
  {
    icon: Zap,
    title: "Alertas Proativos",
    description: "Receba notificações automáticas sobre estresse hídrico, pragas potenciais e janelas ideais de aplicação baseadas em previsão climática.",
    color: "from-amber-500 to-orange-600",
  },
  {
    icon: TrendingUp,
    title: "Análise de Rentabilidade",
    description: "Compare custos e retorno por talhão, identifique áreas de baixo desempenho e simule cenários de investimento.",
    color: "from-rose-500 to-red-600",
  },
  {
    icon: LineChart,
    title: "Histórico Completo de Produtividade",
    description: "Visualize a evolução de cada talhão ao longo das safras, com correlações entre manejo e resultado.",
    color: "from-teal-500 to-cyan-600",
  },
];

const advisorsFeatures = [
  {
    icon: Users,
    title: "Central de Clientes",
    description: "Gerencie todos os seus produtores em um só lugar. Crie contas, defina permissões e compartilhe acesso com um clique.",
    color: "from-blue-500 to-indigo-600",
  },
  {
    icon: Palette,
    title: "Sua Marca, Nossa Tecnologia",
    description: "Personalize relatórios, interface e comunicações com a identidade visual da sua empresa.",
    color: "from-fuchsia-500 to-pink-600",
  },
  {
    icon: TestTube,
    title: "Validação de Recomendações",
    description: "Comprove o impacto das suas orientações com testes de campo que geram dados concretos para seus clientes.",
    color: "from-green-500 to-emerald-600",
  },
  {
    icon: Cpu,
    title: "Prescrições com IA Ajustável",
    description: "Crie mapas de aplicação com nossa IA e refine manualmente baseado na sua experiência local.",
    color: "from-orange-500 to-amber-600",
  },
  {
    icon: ScanLine,
    title: "Histórico de Culturas Automático",
    description: "IA identifica automaticamente as culturas plantadas nos últimos anos para planejamento de rotação.",
    color: "from-cyan-500 to-blue-600",
  },
  {
    icon: Globe,
    title: "Gestão Remota Total",
    description: "Monitore e oriente seus clientes de qualquer lugar. Colaboração em tempo real entre web e mobile.",
    color: "from-teal-500 to-green-600",
  },
];

const precisionFeatures = [
  {
    icon: Layers,
    title: "Zonas de Manejo Automatizadas",
    description: "Geração inteligente de zonas baseada em produtividade histórica, reduzindo amostras mantendo qualidade.",
    color: "from-amber-500 to-orange-600",
  },
  {
    icon: FileText,
    title: "Laudos de Solo Profissionais",
    description: "Importe resultados de laboratório e gere relatórios visuais de fácil compreensão para produtores.",
    color: "from-green-500 to-emerald-600",
  },
  {
    icon: Map,
    title: "Integração com Maquinário",
    description: "Exporte diretamente para John Deere, Case, New Holland e outras marcas. Importação de dados de colheita.",
    color: "from-blue-500 to-indigo-600",
  },
  {
    icon: BarChart3,
    title: "Dashboard de Performance",
    description: "Visualize indicadores de cada talhão: produtividade, custo por hectare, retorno sobre investimento.",
    color: "from-purple-500 to-violet-600",
  },
];

// Hero content único para cada tab
const heroContent = {
  growers: {
    title: "Transforme dados em decisões que aumentam sua produtividade",
    subtitle: "Tecnologia brasileira para agricultura brasileira",
    image: "🌱",
    gradient: "from-emerald-500/20 to-green-500/20",
  },
  advisors: {
    title: "Potencialize seus serviços com tecnologia de ponta",
    subtitle: "Mais valor para seus clientes, mais resultados para você",
    image: "📊",
    gradient: "from-blue-500/20 to-indigo-500/20",
  },
  precision: {
    title: "Agricultura de precisão acessível e eficiente",
    subtitle: "Do dado à ação em poucos cliques",
    image: "🎯",
    gradient: "from-amber-500/20 to-orange-500/20",
  },
};

export default function Pro() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>("growers");
  const [formData, setFormData] = useState({ name: "", phone: "", email: "" });

  const getFeatures = () => {
    switch (activeTab) {
      case "growers": return growersFeatures;
      case "advisors": return advisorsFeatures;
      case "precision": return precisionFeatures;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Obrigado ${formData.name}! Entraremos em contato em breve.`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setLocation("/")}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-slate-600" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/25">
                  <Leaf className="h-6 w-6 text-white" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-slate-900">Campo Vivo</span>
                  <div className="flex items-center gap-1 bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
                    <Crown className="h-3 w-3" />
                    SAFRA
                  </div>
                </div>
              </div>
            </div>
            <Button 
              onClick={() => setLocation("/dashboard")}
              className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/25"
            >
              Acessar Dashboard
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-100 via-white to-slate-50" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-300 rounded-full blur-[100px] opacity-30" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-amber-200 rounded-full blur-[100px] opacity-30" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-3 bg-white rounded-full px-5 py-2.5 shadow-xl shadow-slate-200/50 mb-8 border border-slate-100">
              <div className="flex items-center gap-1.5">
                <Wheat className="h-5 w-5 text-amber-500" />
                <span className="text-lg font-bold text-slate-900">Plano</span>
              </div>
              <div className="flex items-center gap-1 bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-900 text-sm font-bold px-3 py-1 rounded-full">
                <Crown className="h-3.5 w-3.5" />
                SAFRA
              </div>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-6 leading-tight">
              Sua lavoura merece{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-green-500">
                tecnologia de verdade
              </span>
            </h1>
            
            <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
              Desenvolvido no Brasil, para os desafios do campo brasileiro
            </p>

            {/* Tabs */}
            <div className="inline-flex bg-slate-100 rounded-2xl p-1.5 mb-12 shadow-inner">
              {[
                { id: "growers" as TabType, label: "Produtores", icon: Wheat },
                { id: "advisors" as TabType, label: "Consultores", icon: Users },
                { id: "precision" as TabType, label: "Agricultura de Precisão", icon: Target },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? "bg-white text-slate-900 shadow-lg shadow-slate-200/50"
                      : "text-slate-600 hover:text-slate-900"
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

      {/* Hero Card */}
      <section className="relative -mt-6 mb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`bg-gradient-to-br ${heroContent[activeTab].gradient} rounded-3xl p-8 md:p-12 border border-white/60 shadow-2xl shadow-slate-200/50`}>
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="text-8xl drop-shadow-lg">{heroContent[activeTab].image}</div>
              <div className="text-center md:text-left flex-1">
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">
                  {heroContent[activeTab].title}
                </h2>
                <p className="text-slate-600 mb-4">{heroContent[activeTab].subtitle}</p>
                <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                  <span className="inline-flex items-center gap-1.5 text-sm text-slate-700 bg-white/80 px-3 py-1.5 rounded-full border border-slate-200/50">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    100% Nacional
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm text-slate-700 bg-white/80 px-3 py-1.5 rounded-full border border-slate-200/50">
                    <Shield className="h-4 w-4 text-emerald-500" />
                    Dados Seguros
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm text-slate-700 bg-white/80 px-3 py-1.5 rounded-full border border-slate-200/50">
                    <Zap className="h-4 w-4 text-blue-500" />
                    Suporte Local
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
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              Recursos que fazem diferença
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Cada funcionalidade foi pensada para a realidade do produtor brasileiro
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {getFeatures().map((feature, index) => (
              <div
                key={index}
                className="group bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:border-slate-200 transition-all duration-300 hover:-translate-y-1"
              >
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform shadow-lg`}>
                  <feature.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              Por que escolher o Campo Vivo?
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Feito para entender as particularidades do agro brasileiro
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Sun, title: "Clima Brasileiro", desc: "Modelos calibrados para nossas condições", color: "from-amber-500 to-orange-500" },
              { icon: CloudRain, title: "Sazonalidade Local", desc: "Entende safra e safrinha", color: "from-blue-500 to-cyan-500" },
              { icon: Wheat, title: "Culturas Nacionais", desc: "Soja, milho, café, cana e mais", color: "from-emerald-500 to-green-500" },
              { icon: Shield, title: "Suporte em Português", desc: "Time local para te ajudar", color: "from-violet-500 to-purple-500" },
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 text-center border border-slate-100 shadow-sm">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mx-auto mb-4 shadow-lg`}>
                  <item.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              Planos para cada momento
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Comece gratuitamente e evolua conforme sua necessidade
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Plan */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-lg transition-shadow">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Leaf className="h-6 w-6 text-slate-600" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-1">Semente</h3>
                <p className="text-sm text-slate-500">Para começar</p>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-slate-900">Grátis</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "Até 5 talhões",
                  "Monitoramento NDVI básico",
                  "Dados climáticos",
                  "Notas de campo",
                  "App mobile",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-slate-600">
                    <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Check className="h-3 w-3 text-slate-500" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <Button 
                variant="outline" 
                className="w-full h-12 rounded-xl border-slate-200"
                onClick={() => setLocation("/dashboard")}
              >
                Começar Agora
              </Button>
            </div>

            {/* Safra Plan */}
            <div className="relative bg-gradient-to-br from-emerald-600 via-green-600 to-emerald-700 rounded-3xl p-8 shadow-2xl shadow-emerald-500/30 scale-105">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-yellow-400 text-amber-900 text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                  <Star className="h-3.5 w-3.5" />
                  MAIS POPULAR
                </div>
              </div>
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                  <Crown className="h-6 w-6 text-amber-300" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-1">Safra</h3>
                <p className="text-sm text-emerald-100">Para produzir mais</p>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-white">R$ 89</span>
                  <span className="text-emerald-100 text-sm">/mês</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "Talhões ilimitados",
                  "NDVI histórico completo",
                  "Mapas de aplicação VRA",
                  "Zonas de manejo IA",
                  "Alertas proativos",
                  "Análise de produtividade",
                  "Suporte prioritário",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-white">
                    <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                      <Check className="h-3 w-3 text-emerald-200" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <Button className="w-full h-12 bg-white text-emerald-700 hover:bg-emerald-50 rounded-xl font-semibold shadow-lg">
                Teste 14 dias grátis
              </Button>
              <p className="text-center text-xs text-emerald-200 mt-3">Sem cartão de crédito</p>
            </div>

            {/* Elite Plan */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-lg transition-shadow">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Award className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-1">Safra Elite</h3>
                <p className="text-sm text-slate-500">Para consultores</p>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-slate-900">R$ 249</span>
                  <span className="text-slate-500 text-sm">/mês</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "Tudo do Safra",
                  "Multi-clientes ilimitados",
                  "Marca personalizada",
                  "Relatórios white-label",
                  "API de integração",
                  "Treinamento dedicado",
                  "Gerente de sucesso",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-slate-600">
                    <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                      <Check className="h-3 w-3 text-violet-600" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full h-12 rounded-xl border-slate-200">
                Falar com Especialista
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-slate-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500 rounded-full blur-[150px] opacity-20" />
            
            <div className="relative">
              <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-400 text-sm font-medium px-4 py-2 rounded-full mb-6 border border-emerald-500/30">
                <Zap className="h-4 w-4" />
                Comece em menos de 2 minutos
              </div>

              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Pronto para colher resultados?
              </h2>
              <p className="text-slate-400 mb-8 max-w-lg mx-auto">
                Junte-se a milhares de produtores que já estão usando tecnologia para produzir mais
              </p>

              <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-4">
                <div className="flex gap-3">
                  <Input
                    type="text"
                    placeholder="Seu nome"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 h-12 rounded-xl flex-1"
                    required
                  />
                  <Input
                    type="tel"
                    placeholder="WhatsApp"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 h-12 rounded-xl flex-1"
                    required
                  />
                </div>
                <Button 
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30"
                >
                  Quero Testar Grátis
                  <ChevronRight className="h-5 w-5 ml-1" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-white py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                <Leaf className="h-6 w-6 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold">Campo Vivo</span>
                <p className="text-xs text-slate-500">Tecnologia brasileira para o agro</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <a href="#" className="hover:text-white transition-colors">Termos</a>
              <a href="#" className="hover:text-white transition-colors">Privacidade</a>
              <a href="#" className="hover:text-white transition-colors">Suporte</a>
              <a href="#" className="hover:text-white transition-colors">Blog</a>
            </div>
            
            <p className="text-sm text-slate-500">
              © 2025 Campo Vivo. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
