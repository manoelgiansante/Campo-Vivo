import { useState } from "react";
import { 
  ChevronLeft, 
  Check,
  Crown,
  Zap,
  Building2,
  Sparkles,
  Star,
  CreditCard,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { toast } from "sonner";

interface Plan {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  features: string[];
  highlighted?: boolean;
  badge?: string;
}

const plans: Plan[] = [
  {
    id: "free",
    name: "Gratuito",
    description: "Para começar a monitorar seus campos",
    priceMonthly: 0,
    priceYearly: 0,
    icon: <Zap className="h-6 w-6" />,
    color: "text-gray-600",
    bgColor: "bg-gray-100",
    features: [
      "Até 5 campos",
      "NDVI básico (última imagem)",
      "Previsão do tempo 5 dias",
      "Notas de campo ilimitadas",
      "Compartilhamento básico",
    ],
  },
  {
    id: "pro",
    name: "Profissional",
    description: "Para produtores que buscam eficiência",
    priceMonthly: 49,
    priceYearly: 490,
    icon: <Crown className="h-6 w-6" />,
    color: "text-amber-600",
    bgColor: "bg-amber-100",
    highlighted: true,
    badge: "Mais Popular",
    features: [
      "Campos ilimitados",
      "NDVI histórico (2 anos)",
      "Gráficos de clima avançados",
      "Comparação de imagens satélite",
      "Mapas de prescrição (VRA)",
      "Exportação de dados (CSV, PDF)",
      "Modo offline completo",
      "Suporte por email",
    ],
  },
  {
    id: "enterprise",
    name: "Empresarial",
    description: "Para grandes operações agrícolas",
    priceMonthly: 0, // Custom pricing
    priceYearly: 0,
    icon: <Building2 className="h-6 w-6" />,
    color: "text-green-600",
    bgColor: "bg-green-100",
    features: [
      "Tudo do Profissional",
      "NDVI histórico (8 anos)",
      "Amostragem de solo por zonas",
      "Análise de rendimento",
      "Exportação para maquinário",
      "API de integração",
      "Múltiplos usuários",
      "Suporte dedicado",
    ],
  },
];

export default function PlansPage() {
  const [, setLocation] = useLocation();
  const [isYearly, setIsYearly] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const handleSelectPlan = (plan: Plan) => {
    if (plan.id === "free") {
      toast.info("Você já está no plano gratuito");
      return;
    }
    
    if (plan.id === "enterprise") {
      // Open contact dialog or redirect
      toast.info("Entre em contato para plano empresarial: contato@campovivo.com.br");
      return;
    }
    
    setSelectedPlan(plan);
    setShowPayment(true);
  };
  
  const handlePayment = async () => {
    setIsProcessing(true);
    
    // Simulate payment processing
    await new Promise(r => setTimeout(r, 2000));
    
    setIsProcessing(false);
    setShowPayment(false);
    
    toast.success("Assinatura realizada com sucesso! 🎉");
    setLocation("/profile");
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Header */}
      <div className="px-4 pt-4 pb-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setLocation("/profile")} className="p-1">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Planos</h1>
            <p className="text-sm text-gray-500">Escolha o melhor para você</p>
          </div>
        </div>
        
        {/* Yearly/Monthly Toggle */}
        <div className="flex items-center justify-center gap-3 bg-white rounded-full p-2 shadow-sm">
          <span className={`text-sm ${!isYearly ? "font-semibold text-gray-900" : "text-gray-500"}`}>
            Mensal
          </span>
          <Switch checked={isYearly} onCheckedChange={setIsYearly} />
          <span className={`text-sm ${isYearly ? "font-semibold text-gray-900" : "text-gray-500"}`}>
            Anual
          </span>
          {isYearly && (
            <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-1 rounded-full">
              -17%
            </span>
          )}
        </div>
      </div>
      
      {/* Plans */}
      <div className="px-4 space-y-4 pb-8">
        {plans.map(plan => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isYearly={isYearly}
            onSelect={() => handleSelectPlan(plan)}
          />
        ))}
      </div>
      
      {/* Trust Badges */}
      <div className="px-4 pb-8">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <span className="font-semibold text-gray-900">Garantia de satisfação</span>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Experimente por 7 dias. Se não gostar, devolvemos seu dinheiro sem perguntas.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <TrustBadge icon="🔒" label="Pagamento seguro" />
            <TrustBadge icon="💳" label="Cancele quando quiser" />
            <TrustBadge icon="🇧🇷" label="Suporte em PT-BR" />
          </div>
        </div>
      </div>
      
      {/* FAQ */}
      <div className="px-4 pb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Perguntas Frequentes</h2>
        <div className="space-y-3">
          <FAQItem 
            question="Posso trocar de plano depois?" 
            answer="Sim! Você pode fazer upgrade ou downgrade a qualquer momento. O valor é calculado proporcionalmente."
          />
          <FAQItem 
            question="Como funciona o pagamento?" 
            answer="Aceitamos cartão de crédito, PIX e boleto. O pagamento é processado de forma segura pelo Stripe."
          />
          <FAQItem 
            question="Meus dados estão seguros?" 
            answer="Sim, todos os dados são criptografados e armazenados em servidores seguros. Nunca compartilhamos suas informações."
          />
          <FAQItem 
            question="Preciso de cartão para o plano gratuito?" 
            answer="Não! O plano gratuito não requer cartão de crédito. Você só paga se decidir fazer upgrade."
          />
        </div>
      </div>
      
      {/* Compare Plans */}
      <div className="px-4 pb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Compare os planos</h2>
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Recurso</th>
                <th className="px-2 py-3 text-center font-medium text-gray-500">Free</th>
                <th className="px-2 py-3 text-center font-medium text-amber-600">Pro</th>
                <th className="px-2 py-3 text-center font-medium text-green-600">Emp.</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <CompareRow feature="Campos" free="5" pro="∞" enterprise="∞" />
              <CompareRow feature="NDVI histórico" free="1 mês" pro="2 anos" enterprise="8 anos" />
              <CompareRow feature="Gráficos de clima" free={false} pro={true} enterprise={true} />
              <CompareRow feature="Comparar satélite" free={false} pro={true} enterprise={true} />
              <CompareRow feature="Mapa de prescrição" free={false} pro={true} enterprise={true} />
              <CompareRow feature="Exportação" free={false} pro={true} enterprise={true} />
              <CompareRow feature="Modo offline" free="Básico" pro="Completo" enterprise="Completo" />
              <CompareRow feature="Usuários" free="1" pro="1" enterprise="∞" />
              <CompareRow feature="API" free={false} pro={false} enterprise={true} />
              <CompareRow feature="Suporte" free="Comunidade" pro="Email" enterprise="Dedicado" />
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Payment Dialog */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar Assinatura</DialogTitle>
            <DialogDescription>
              {selectedPlan?.name} - {isYearly ? "Anual" : "Mensal"}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPlan && (
            <div className="py-4">
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Plano</span>
                  <span className="font-semibold">{selectedPlan.name}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Período</span>
                  <span className="font-semibold">{isYearly ? "12 meses" : "1 mês"}</span>
                </div>
                <div className="border-t my-2" />
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="text-2xl font-bold text-green-600">
                    R$ {isYearly ? selectedPlan.priceYearly : selectedPlan.priceMonthly}
                  </span>
                </div>
                {isYearly && (
                  <p className="text-xs text-gray-500 text-right mt-1">
                    (R$ {(selectedPlan.priceYearly / 12).toFixed(0)}/mês)
                  </p>
                )}
              </div>
              
              {/* Payment Method */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">Forma de pagamento</p>
                <button className="w-full border rounded-xl p-3 flex items-center gap-3 hover:border-green-500 transition-colors">
                  <CreditCard className="h-5 w-5 text-gray-500" />
                  <span>Cartão de Crédito</span>
                </button>
                <button className="w-full border rounded-xl p-3 flex items-center gap-3 hover:border-green-500 transition-colors">
                  <span className="text-lg">💳</span>
                  <span>PIX</span>
                </button>
              </div>
              
              <Button 
                className="w-full mt-4" 
                onClick={handlePayment}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    Assinar Agora
                  </>
                )}
              </Button>
              
              <p className="text-xs text-gray-500 text-center mt-3">
                Ao continuar, você concorda com os Termos de Uso e Política de Privacidade
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Plan Card Component
function PlanCard({ 
  plan, 
  isYearly, 
  onSelect 
}: { 
  plan: Plan; 
  isYearly: boolean; 
  onSelect: () => void;
}) {
  const price = isYearly ? plan.priceYearly : plan.priceMonthly;
  const isEnterprise = plan.id === "enterprise";
  
  return (
    <div className={`bg-white rounded-2xl p-5 shadow-sm relative ${
      plan.highlighted ? "ring-2 ring-amber-500" : ""
    }`}>
      {plan.badge && (
        <span className="absolute -top-2 left-4 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full">
          {plan.badge}
        </span>
      )}
      
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${plan.bgColor}`}>
              <div className={plan.color}>{plan.icon}</div>
            </div>
            <div>
              <h3 className="font-bold text-gray-900">{plan.name}</h3>
              <p className="text-xs text-gray-500">{plan.description}</p>
            </div>
          </div>
        </div>
        
        <div className="text-right">
          {isEnterprise ? (
            <p className="text-sm font-semibold text-gray-900">Sob consulta</p>
          ) : price === 0 ? (
            <p className="text-2xl font-bold text-gray-900">Grátis</p>
          ) : (
            <>
              <p className="text-2xl font-bold text-gray-900">R$ {price}</p>
              <p className="text-xs text-gray-500">
                {isYearly ? "/ano" : "/mês"}
              </p>
            </>
          )}
        </div>
      </div>
      
      <ul className="space-y-2 mb-4">
        {plan.features.slice(0, 5).map((feature, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <Check className={`h-4 w-4 ${plan.color}`} />
            <span className="text-gray-700">{feature}</span>
          </li>
        ))}
        {plan.features.length > 5 && (
          <li className="text-xs text-gray-500 pl-6">
            + {plan.features.length - 5} recursos adicionais
          </li>
        )}
      </ul>
      
      <Button 
        className="w-full" 
        variant={plan.highlighted ? "default" : "outline"}
        onClick={onSelect}
      >
        {plan.id === "free" ? "Plano Atual" : 
         plan.id === "enterprise" ? "Falar com Vendas" : 
         "Assinar"}
      </Button>
    </div>
  );
}

// Trust Badge Component
function TrustBadge({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="text-center">
      <span className="text-2xl">{icon}</span>
      <p className="text-xs text-gray-600 mt-1">{label}</p>
    </div>
  );
}

// FAQ Item Component
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div 
      className="bg-white rounded-xl p-4 shadow-sm cursor-pointer"
      onClick={() => setIsOpen(!isOpen)}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-gray-900">{question}</span>
        <span className={`transition-transform ${isOpen ? "rotate-180" : ""}`}>▼</span>
      </div>
      {isOpen && (
        <p className="text-sm text-gray-600 mt-2">{answer}</p>
      )}
    </div>
  );
}

// Compare Row Component
function CompareRow({ 
  feature, 
  free, 
  pro, 
  enterprise 
}: { 
  feature: string; 
  free: string | boolean; 
  pro: string | boolean; 
  enterprise: string | boolean;
}) {
  const renderValue = (value: string | boolean) => {
    if (typeof value === "boolean") {
      return value ? (
        <Check className="h-4 w-4 text-green-500 mx-auto" />
      ) : (
        <span className="text-gray-300">—</span>
      );
    }
    return <span className="text-gray-700">{value}</span>;
  };
  
  return (
    <tr>
      <td className="px-4 py-2 text-gray-600">{feature}</td>
      <td className="px-2 py-2 text-center">{renderValue(free)}</td>
      <td className="px-2 py-2 text-center bg-amber-50">{renderValue(pro)}</td>
      <td className="px-2 py-2 text-center">{renderValue(enterprise)}</td>
    </tr>
  );
}
