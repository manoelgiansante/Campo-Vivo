import { Button } from "@/components/ui/button";
import { 
  Cloud,
  ChevronRight,
  Settings,
  Monitor,
  History,
  MessageCircle,
  FileText,
  Send,
  HelpCircle,
  LogOut
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

export default function ProfileOneSoil() {
  const [, setLocation] = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-100 pb-24">
        {/* Not Logged In View */}
        <div className="p-4">
          <div className="bg-white rounded-2xl p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <Cloud className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-600 mb-6">
              Create an account or sign in to save your data and access the web application with enhanced functionality.
            </p>
            <Button 
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold h-12 rounded-xl mb-3"
              onClick={() => setIsLoggedIn(true)}
            >
              I'm a new user
            </Button>
            <Button 
              variant="outline"
              className="w-full h-12 rounded-xl font-semibold"
              onClick={() => setIsLoggedIn(true)}
            >
              I have an account
            </Button>
          </div>
        </div>

        {/* Settings Section */}
        <div className="p-4">
          <div className="bg-white rounded-2xl overflow-hidden">
            <p className="text-sm text-gray-500 px-4 pt-4 pb-2">Account</p>
            <MenuItem 
              icon={<Settings className="h-5 w-5 text-green-600" />}
              label="Settings"
              onClick={() => {}}
            />
          </div>
        </div>

        {/* Learn More Section */}
        <div className="p-4 pt-0">
          <div className="bg-white rounded-2xl overflow-hidden">
            <p className="text-sm text-gray-500 px-4 pt-4 pb-2">Learn more</p>
            <MenuItem 
              icon={<Monitor className="h-5 w-5 text-green-600" />}
              label="Web version features"
              onClick={() => {}}
            />
            <MenuItem 
              icon={<History className="h-5 w-5 text-green-600" />}
              label="Updates history"
              onClick={() => {}}
            />
          </div>
        </div>

        {/* Support Section */}
        <div className="p-4 pt-0">
          <div className="bg-white rounded-2xl overflow-hidden">
            <p className="text-sm text-gray-500 px-4 pt-4 pb-2">Support & Help</p>
            <MenuItem 
              icon={<MessageCircle className="h-5 w-5 text-green-600" />}
              label="Support chat"
              onClick={() => {}}
            />
            <MenuItem 
              icon={<FileText className="h-5 w-5 text-green-600" />}
              label="User Guide"
              onClick={() => {}}
            />
            <MenuItem 
              icon={<Send className="h-5 w-5 text-green-600" />}
              label="Telegram community"
              onClick={() => {}}
            />
          </div>
        </div>
      </div>
    );
  }

  // Logged In View
  return (
    <div className="min-h-screen bg-gray-100 pb-24">
      {/* Profile Header */}
      <div className="p-4">
        <div className="bg-white rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-green-600">M</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Manoel</h2>
              <p className="text-gray-500">manoel@campovivo.com</p>
            </div>
          </div>
        </div>
      </div>

      {/* Account Section */}
      <div className="p-4 pt-0">
        <div className="bg-white rounded-2xl overflow-hidden">
          <p className="text-sm text-gray-500 px-4 pt-4 pb-2">Account</p>
          <MenuItem 
            icon={<Settings className="h-5 w-5 text-green-600" />}
            label="Settings"
            onClick={() => {}}
          />
        </div>
      </div>

      {/* Learn More Section */}
      <div className="p-4 pt-0">
        <div className="bg-white rounded-2xl overflow-hidden">
          <p className="text-sm text-gray-500 px-4 pt-4 pb-2">Learn more</p>
          <MenuItem 
            icon={<Monitor className="h-5 w-5 text-green-600" />}
            label="Web version features"
            onClick={() => {}}
          />
          <MenuItem 
            icon={<History className="h-5 w-5 text-green-600" />}
            label="Updates history"
            onClick={() => {}}
          />
        </div>
      </div>

      {/* Support Section */}
      <div className="p-4 pt-0">
        <div className="bg-white rounded-2xl overflow-hidden">
          <p className="text-sm text-gray-500 px-4 pt-4 pb-2">Support & Help</p>
          <MenuItem 
            icon={<MessageCircle className="h-5 w-5 text-green-600" />}
            label="Support chat"
            onClick={() => {}}
          />
          <MenuItem 
            icon={<FileText className="h-5 w-5 text-green-600" />}
            label="User Guide"
            onClick={() => {}}
          />
          <MenuItem 
            icon={<Send className="h-5 w-5 text-green-600" />}
            label="Telegram community"
            onClick={() => {}}
          />
        </div>
      </div>

      {/* Logout */}
      <div className="p-4 pt-0">
        <Button 
          variant="ghost"
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={() => setIsLoggedIn(false)}
        >
          <LogOut className="h-5 w-5 mr-3" />
          Sign out
        </Button>
      </div>
    </div>
  );
}

// Menu Item Component
function MenuItem({
  icon,
  label,
  onClick,
  danger = false
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors ${
        danger ? "text-red-600" : "text-gray-900"
      }`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span>{label}</span>
      </div>
      <ChevronRight className="h-5 w-5 text-gray-400" />
    </button>
  );
}
