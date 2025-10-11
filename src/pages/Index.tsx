import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GraduationCap, Users, FileText, BarChart } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Auto-redirect to auth if not logged in
    navigate("/auth");
  }, [navigate]);

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="inline-block p-4 rounded-3xl mb-6" style={{ background: "var(--gradient-primary)" }}>
            <GraduationCap className="w-16 h-16 text-white" />
          </div>
          <h1 className="text-5xl font-bold mb-4 gradient-text">
            ระบบติดตามใบ Coaching
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            มหาวิทยาลัยศรีปทุม
          </p>
          <Button size="lg" onClick={() => navigate("/auth")}>
            เข้าสู่ระบบ
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="bg-card rounded-2xl p-6 border border-border card-hover">
            <div className="p-3 rounded-xl mb-4 w-fit" style={{ background: "var(--gradient-primary)" }}>
              <Users className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">สำหรับนักศึกษา</h3>
            <p className="text-muted-foreground">
              อัปโหลดใบ coaching และติดตามความคืบหน้าของคุณ
            </p>
          </div>

          <div className="bg-card rounded-2xl p-6 border border-border card-hover">
            <div className="p-3 rounded-xl mb-4 w-fit" style={{ background: "var(--gradient-accent)" }}>
              <FileText className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">สำหรับอาจารย์</h3>
            <p className="text-muted-foreground">
              ตรวจสอบและอนุมัติใบ coaching ของนักศึกษา
            </p>
          </div>

          <div className="bg-card rounded-2xl p-6 border border-border card-hover">
            <div className="p-3 rounded-xl mb-4 w-fit" style={{ background: "linear-gradient(135deg, hsl(270 75% 60%), hsl(290 75% 55%))" }}>
              <BarChart className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">สำหรับผู้ดูแล</h3>
            <p className="text-muted-foreground">
              จัดการระบบและส่งออกรายงาน
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
