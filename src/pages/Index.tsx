import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { GraduationCap, Users, FileText, BarChart, Sparkles, Shield, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <Navbar />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16 animate-fade-in-up">
            <div className="inline-block p-6 rounded-3xl mb-8 animate-float" style={{ background: "var(--gradient-primary)" }}>
              <GraduationCap className="w-20 h-20 text-white" />
            </div>
            <h1 className="text-6xl md:text-7xl font-bold mb-6 gradient-text tracking-tight">
              ระบบติดตามใบ Coaching
            </h1>
            <p className="text-2xl md:text-3xl text-muted-foreground mb-4">
              มหาวิทยาลัยศรีปทุม
            </p>
            <p className="text-lg text-muted-foreground/80 mb-10 max-w-2xl mx-auto">
              คณะการสร้างเจ้าของธุรกิจ x SPU AI CLUB
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Button 
                size="lg" 
                onClick={() => navigate("/auth")}
                className="apple-button-primary text-lg px-8 py-6 h-auto"
              >
                เริ่มต้นใช้งาน
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate("/auth")}
                className="apple-button text-lg px-8 py-6 h-auto border-2"
              >
                เข้าสู่ระบบ
              </Button>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-20">
            <div className="bg-card rounded-3xl p-8 border-2 border-border card-hover animate-stagger-1">
              <div className="p-4 rounded-2xl mb-6 w-fit" style={{ background: "var(--gradient-primary)" }}>
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-3">สำหรับนักศึกษา</h3>
              <p className="text-muted-foreground text-lg">
                อัปโหลดใบ coaching และติดตามความคืบหน้าของคุณได้อย่างง่ายดาย
              </p>
            </div>

            <div className="bg-card rounded-3xl p-8 border-2 border-border card-hover animate-stagger-2">
              <div className="p-4 rounded-2xl mb-6 w-fit" style={{ background: "var(--gradient-accent)" }}>
                <FileText className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-3">สำหรับอาจารย์</h3>
              <p className="text-muted-foreground text-lg">
                ตรวจสอบและให้คำแนะนำใบ coaching ของนักศึกษาอย่างมีประสิทธิภาพ
              </p>
            </div>

            <div className="bg-card rounded-3xl p-8 border-2 border-border card-hover animate-stagger-3">
              <div className="p-4 rounded-2xl mb-6 w-fit" style={{ background: "linear-gradient(135deg, hsl(270 75% 60%), hsl(290 75% 55%))" }}>
                <BarChart className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-3">สำหรับผู้ดูแล</h3>
              <p className="text-muted-foreground text-lg">
                จัดการระบบและส่งออกรายงานได้ครบถ้วนในที่เดียว
              </p>
            </div>
          </div>

          {/* Additional Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <div className="bg-card/50 backdrop-blur-sm rounded-2xl p-6 border border-border/50 animate-stagger-4">
              <Sparkles className="w-6 h-6 text-primary mb-3" />
              <h4 className="font-semibold mb-2">ใช้งานง่าย</h4>
              <p className="text-sm text-muted-foreground">
                ออกแบบให้ใช้งานง่าย เข้าใจได้ทันที
              </p>
            </div>

            <div className="bg-card/50 backdrop-blur-sm rounded-2xl p-6 border border-border/50 animate-stagger-5">
              <Shield className="w-6 h-6 text-primary mb-3" />
              <h4 className="font-semibold mb-2">ปลอดภัย</h4>
              <p className="text-sm text-muted-foreground">
                ข้อมูลของคุณได้รับการปกป้องอย่างมั่นคง
              </p>
            </div>

            <div className="bg-card/50 backdrop-blur-sm rounded-2xl p-6 border border-border/50 animate-stagger-6">
              <Zap className="w-6 h-6 text-primary mb-3" />
              <h4 className="font-semibold mb-2">รวดเร็ว</h4>
              <p className="text-sm text-muted-foreground">
                ประมวลผลรวดเร็ว ตอบสนองทันที
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
