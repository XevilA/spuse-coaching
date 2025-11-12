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
}

export const DashboardLayout = ({ children, role, userName }: DashboardLayoutProps) => {
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

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-lg animate-fade-in">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div 
                className="p-3 rounded-2xl transition-all duration-300 hover-scale" 
                style={{ background: "var(--gradient-primary)" }}
              >
                <GraduationCap className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">ระบบติดตามใบ Coaching</h1>
                <p className="text-sm text-muted-foreground">คณะการสร้างเจ้าของธุรกิจ x SPU AI CLUB</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-foreground">{userName}</p>
                <p className="text-xs text-muted-foreground">{getRoleLabel()}</p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleLogout} 
                className="apple-button border-2"
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