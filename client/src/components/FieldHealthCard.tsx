import { useMemo } from "react";
import { 
  Activity, 
  AlertTriangle, 
  Bug, 
  Droplets, 
  Leaf, 
  ThermometerSun,
  TrendingUp,
  TrendingDown,
  Shield,
  CheckCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface FieldHealthCardProps {
  ndvi?: number;
  ndviTrend?: "up" | "down" | "stable";
  weather?: {
    temperature: number;
    humidity: number;
    precipitation: number;
  };
  className?: string;
}

// Calcula score de saúde baseado em NDVI e clima
function calculateHealthScore(
  ndvi?: number,
  weather?: { temperature: number; humidity: number; precipitation: number }
): number {
  let score = 50;
  
  // NDVI contribui 60% do score
  if (ndvi !== undefined) {
    if (ndvi >= 0.7) score += 30;
    else if (ndvi >= 0.5) score += 20;
    else if (ndvi >= 0.3) score += 10;
    else if (ndvi < 0.2) score -= 10;
  }
  
  // Clima contribui 40% do score
  if (weather) {
    // Temperatura ideal entre 20-30°C
    if (weather.temperature >= 20 && weather.temperature <= 30) {
      score += 10;
    } else if (weather.temperature < 10 || weather.temperature > 38) {
      score -= 10;
    }
    
    // Umidade ideal entre 50-70%
    if (weather.humidity >= 50 && weather.humidity <= 70) {
      score += 5;
    }
    
    // Precipitação adequada
    if (weather.precipitation > 0 && weather.precipitation < 50) {
      score += 5;
    }
  }
  
  return Math.max(0, Math.min(100, score));
}

// Determina riscos de pragas baseado no clima
function getPestRisks(weather?: { temperature: number; humidity: number; precipitation: number }): Array<{
  name: string;
  namePt: string;
  risk: "low" | "medium" | "high";
  description: string;
}> {
  if (!weather) return [];
  
  const risks = [];
  
  // Ferrugem asiática - favorecida por temperatura amena e alta umidade
  if (weather.temperature >= 18 && weather.temperature <= 28 && weather.humidity > 70) {
    risks.push({
      name: "Asian Soybean Rust",
      namePt: "Ferrugem Asiática",
      risk: weather.humidity > 85 ? "high" as const : "medium" as const,
      description: "Condições favoráveis: temp. 18-28°C com umidade >70%"
    });
  }
  
  // Lagarta - favorecida por temperatura alta
  if (weather.temperature >= 25 && weather.precipitation < 10) {
    risks.push({
      name: "Caterpillar",
      namePt: "Lagarta da Soja",
      risk: weather.temperature > 30 ? "high" as const : "medium" as const,
      description: "Condições favoráveis: temp. >25°C com baixa chuva"
    });
  }
  
  // Ácaro - favorecido por seca e calor
  if (weather.temperature > 28 && weather.humidity < 50) {
    risks.push({
      name: "Spider Mite",
      namePt: "Ácaro Rajado",
      risk: "medium" as const,
      description: "Condições favoráveis: temp. >28°C com baixa umidade"
    });
  }
  
  // Percevejos - condições gerais de verão
  if (weather.temperature >= 22 && weather.temperature <= 32) {
    risks.push({
      name: "Stink Bug",
      namePt: "Percevejo",
      risk: "low" as const,
      description: "Monitorar durante enchimento de grãos"
    });
  }
  
  return risks;
}

// Cor do score de saúde
function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-lime-600";
  if (score >= 40) return "text-yellow-600";
  if (score >= 20) return "text-orange-600";
  return "text-red-600";
}

function getScoreBackground(score: number): string {
  if (score >= 80) return "bg-green-100";
  if (score >= 60) return "bg-lime-100";
  if (score >= 40) return "bg-yellow-100";
  if (score >= 20) return "bg-orange-100";
  return "bg-red-100";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Excelente";
  if (score >= 60) return "Bom";
  if (score >= 40) return "Atenção";
  if (score >= 20) return "Alerta";
  return "Crítico";
}

function getRiskColor(risk: "low" | "medium" | "high"): string {
  switch (risk) {
    case "high": return "bg-red-100 text-red-800 border-red-200";
    case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "low": return "bg-green-100 text-green-800 border-green-200";
  }
}

function getRiskLabel(risk: "low" | "medium" | "high"): string {
  switch (risk) {
    case "high": return "Alto";
    case "medium": return "Médio";
    case "low": return "Baixo";
  }
}

export function FieldHealthCard({ ndvi, ndviTrend, weather, className }: FieldHealthCardProps) {
  const healthScore = useMemo(() => calculateHealthScore(ndvi, weather), [ndvi, weather]);
  const pestRisks = useMemo(() => getPestRisks(weather), [weather]);
  const highRisks = pestRisks.filter(r => r.risk === "high" || r.risk === "medium");
  
  return (
    <Card className={`bg-gradient-to-br from-white to-gray-50 border-gray-200 ${className || ""}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-5 w-5 text-green-600" />
          Saúde do Campo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Health Score */}
        <div className="flex items-center gap-4">
          <div className={`w-20 h-20 rounded-2xl ${getScoreBackground(healthScore)} flex flex-col items-center justify-center`}>
            <span className={`text-2xl font-bold ${getScoreColor(healthScore)}`}>{healthScore}</span>
            <span className="text-xs text-gray-500">/ 100</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`font-semibold ${getScoreColor(healthScore)}`}>
                {getScoreLabel(healthScore)}
              </span>
              {ndviTrend === "up" && <TrendingUp className="h-4 w-4 text-green-500" />}
              {ndviTrend === "down" && <TrendingDown className="h-4 w-4 text-red-500" />}
            </div>
            <Progress value={healthScore} className="h-2" />
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              {ndvi !== undefined && (
                <span className="flex items-center gap-1">
                  <Leaf className="h-3 w-3" />
                  NDVI: {ndvi.toFixed(2)}
                </span>
              )}
              {weather && (
                <>
                  <span className="flex items-center gap-1">
                    <ThermometerSun className="h-3 w-3" />
                    {weather.temperature}°C
                  </span>
                  <span className="flex items-center gap-1">
                    <Droplets className="h-3 w-3" />
                    {weather.humidity}%
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Pest Alerts */}
        {pestRisks.length > 0 ? (
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Bug className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium text-gray-700">Alertas de Pragas</span>
              {highRisks.length > 0 && (
                <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-200 text-xs">
                  {highRisks.length} atenção
                </Badge>
              )}
            </div>
            <div className="space-y-2">
              {pestRisks.slice(0, 3).map((pest, index) => (
                <div 
                  key={index} 
                  className={`flex items-center justify-between p-2 rounded-lg border ${getRiskColor(pest.risk)}`}
                >
                  <div>
                    <span className="text-sm font-medium">{pest.namePt}</span>
                    <p className="text-xs opacity-80">{pest.description}</p>
                  </div>
                  <Badge variant="outline" className={getRiskColor(pest.risk)}>
                    {getRiskLabel(pest.risk)}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
              <Shield className="h-5 w-5 text-green-600" />
              <div>
                <span className="text-sm font-medium text-green-800">Sem alertas de pragas</span>
                <p className="text-xs text-green-600">Condições climáticas não favorecem pragas no momento</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Quick Tips */}
        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium text-gray-700">Recomendações</span>
          </div>
          <ul className="text-xs text-gray-600 space-y-1">
            {healthScore < 60 && ndvi !== undefined && ndvi < 0.5 && (
              <li className="flex items-center gap-2">
                <AlertTriangle className="h-3 w-3 text-yellow-500" />
                Verificar estresse hídrico ou nutricional
              </li>
            )}
            {highRisks.length > 0 && (
              <li className="flex items-center gap-2">
                <Bug className="h-3 w-3 text-orange-500" />
                Realizar monitoramento de pragas
              </li>
            )}
            {healthScore >= 60 && (
              <li className="flex items-center gap-2">
                <Leaf className="h-3 w-3 text-green-500" />
                Manter práticas de manejo atuais
              </li>
            )}
            {weather && weather.humidity > 80 && (
              <li className="flex items-center gap-2">
                <Droplets className="h-3 w-3 text-blue-500" />
                Atenção para doenças fúngicas
              </li>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export default FieldHealthCard;
