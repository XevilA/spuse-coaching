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
      default:
        return role;
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <header className="bg-primary border-b border-primary-dark shadow-lg animate-fade-in" style={{ boxShadow: "var(--shadow-glow)" }}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white/10 backdrop-blur-sm hover-scale">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">ระบบติดตามใบ Coaching</h1>
                <p className="text-sm text-white/80">คณะการสร้างเจ้าของธุรกิจ x SPU AI CLUB</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-white">{userName}</p>
                <p className="text-xs text-white/70">{getRoleLabel()}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout} className="border-white/30 text-white hover:bg-white/10 hover-scale">
                <LogOut className="w-4 h-4 mr-2" />
                ออกจากระบบ
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
};