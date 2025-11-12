import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { LogOut, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DashboardLayoutProps {
  children: ReactNode;
  role: string;
  userName: string;
  variant?: "default" | "student";
}

export const DashboardLayout = ({ children, role, userName, variant = "default" }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    } else {
      navigate("/auth");
    }
  };

  const getRoleLabel = () => {
    switch (role) {
      case "super_admin":
        return "Super Admin";
      case "admin":
        return "ผู้ดูแลระบบ";
      case "teacher":
        return "อาจารย์";
      case "student":
        return "นักศึกษา";
      case "external_evaluator":
        return "กรรมการภายนอก";
      default:
        return role;
    }
  };

  const headerStyle = variant === "student" 
    ? "sticky top-0 z-40 backdrop-blur-xl border-b shadow-lg animate-fade-in bg-primary/95"
    : "sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-lg animate-fade-in";
    
  const textStyle = variant === "student" ? "text-white" : "text-foreground";
  const mutedTextStyle = variant === "student" ? "text-white/80" : "text-muted-foreground";

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <header className={headerStyle}>
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div 
                className="p-3 rounded-2xl transition-all duration-300 hover-scale" 
                style={{ 
                  background: variant === "student" ? "rgba(255, 255, 255, 0.2)" : "var(--gradient-primary)" 
                }}
              >
                <GraduationCap className={`w-7 h-7 ${variant === "student" ? "text-white" : "text-white"}`} />
              </div>
              <div>
                <h1 className={`text-xl font-bold ${textStyle}`}>ระบบติดตามใบ Coaching</h1>
                <p className={`text-sm ${mutedTextStyle}`}>คณะการสร้างเจ้าของธุรกิจ x SPU AI CLUB</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className={`text-sm font-semibold ${textStyle}`}>{userName}</p>
                <p className={`text-xs ${mutedTextStyle}`}>{getRoleLabel()}</p>
              </div>
              <Button 
                variant={variant === "student" ? "secondary" : "outline"}
                size="sm" 
                onClick={handleLogout} 
                className={`apple-button ${variant === "student" ? "bg-white/20 hover:bg-white/30 text-white border-white/30" : "border-2"}`}
              >
                <LogOut className="w-4 h-4 mr-2" />
                ออกจากระบบ
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 max-w-7xl">
        {children}
      </main>
    </div>
  );
};