import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AppointmentManager } from "@/components/AppointmentManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, CheckCircle, Clock, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function Student() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [minSessions, setMinSessions] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingSession, setUploadingSession] = useState<number | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Setup realtime subscription for coaching sessions
    const channel = supabase
      .channel('student-sessions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'coaching_sessions',
          filter: `student_id=eq.${user.id}`
        },
        () => {
          if (user?.id) fetchData(user.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .single();

    if (roleData?.role !== "student") {
      navigate(`/${roleData?.role || "auth"}`);
      return;
    }

    setUser(session.user);
    fetchData(session.user.id);
  };

  const fetchData = async (userId: string) => {
    try {
      const [profileRes, sessionsRes, settingsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("coaching_sessions").select("*").eq("student_id", userId).order("session_number"),
        supabase.from("coaching_settings").select("*").eq("key", "min_sessions").single(),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      if (sessionsRes.data) setSessions(sessionsRes.data);
      if (settingsRes.data) setMinSessions(parseInt(settingsRes.data.value));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (sessionNumber: number, file: File) => {
    if (!user) return;

    setUploadingSession(sessionNumber);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${sessionNumber}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("coaching-forms")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from("coaching_sessions")
        .upsert({
          student_id: user.id,
          session_number: sessionNumber,
          file_url: fileName,
          file_name: file.name,
          status: "pending",
        });

      if (dbError) throw dbError;

      toast({
        title: "อัปโหลดสำเร็จ",
        description: `อัปโหลดใบ coaching ครั้งที่ ${sessionNumber} แล้ว`,
      });

      fetchData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "ไม่สามารถอัปโหลดได้",
        description: error.message,
      });
    } finally {
      setUploadingSession(null);
    }
  };

  const handleSubmitAll = async () => {
    if (!user) return;

    const pendingSessions = sessions.filter(s => s.status === "pending" && s.file_url);
    
    if (pendingSessions.length === 0) {
      toast({
        variant: "destructive",
        title: "ไม่มีไฟล์ที่จะส่ง",
        description: "กรุณาอัปโหลดไฟล์ก่อนส่ง",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("coaching_sessions")
        .update({ status: "pending" })
        .in("id", pendingSessions.map(s => s.id));

      if (error) throw error;

      toast({
        title: "ส่งสำเร็จ",
        description: `ส่งใบ coaching ${pendingSessions.length} ไฟล์เพื่อตรวจสอบแล้ว`,
      });

      fetchData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "ไม่สามารถส่งได้",
        description: error.message,
      });
    }
  };

  const viewFile = async (fileUrl: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("coaching-forms")
        .createSignedUrl(fileUrl, 60);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "ไม่สามารถเปิดไฟล์ได้",
        description: error.message,
      });
    }
  };

  const completedSessions = sessions.filter(s => s.status === "approved").length;
  const progressPercentage = (completedSessions / minSessions) * 100;

  const getStatusBadge = (status: string) => {
    if (status === "approved") {
      return <Badge className="bg-success text-success-foreground"><CheckCircle className="w-3 h-3 mr-1" />อนุมัติ</Badge>;
    }
    if (status === "rejected") {
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />ไม่อนุมัติ</Badge>;
    }
    return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />รอตรวจสอบ</Badge>;
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">กำลังโหลด...</div>;
  }

  return (
    <DashboardLayout role="student" userName={`${profile?.first_name} ${profile?.last_name}`}>
      <div className="space-y-6">
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-2xl">ข้อมูลส่วนตัว</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="text-center space-y-2 py-6 border-b">
                <h2 className="text-4xl font-bold text-primary">
                  {profile?.first_name} {profile?.last_name}
                </h2>
                <p className="text-3xl font-semibold text-muted-foreground">
                  {profile?.student_id || "-"}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">ชั้นปี</p>
                  <p className="text-2xl font-bold">{profile?.year_level || "-"}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">สาขา</p>
                  <p className="text-2xl font-bold">{profile?.major || "-"}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">อีเมล</p>
                  <p className="text-lg font-medium break-all">{profile?.email}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <AppointmentManager role="student" userId={user?.id || ""} />
        <Card className="card-hover border-2">
          <CardHeader>
            <CardTitle className="text-2xl">ความคืบหน้า</CardTitle>
            <CardDescription>
              จำนวนครั้งที่ผ่าน: {completedSessions} / {minSessions} ครั้ง
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Progress value={progressPercentage} className="h-3" />
              <p className="text-sm text-muted-foreground text-center">
                {completedSessions >= minSessions 
                  ? "🎉 คุณทำครบจำนวนครั้งที่กำหนดแล้ว!" 
                  : `อีก ${minSessions - completedSessions} ครั้งเพื่อครบตามเกณฑ์`}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  อัปโหลดใบ Coaching
                </CardTitle>
                <CardDescription>อัปโหลดใบ coaching ของแต่ละครั้ง</CardDescription>
              </div>
              <Button 
                onClick={handleSubmitAll}
                disabled={sessions.filter(s => s.status === "pending" && s.file_url).length === 0}
              >
                ส่งทั้งหมด
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: minSessions }, (_, i) => i + 1).map((sessionNum) => {
                const session = sessions.find(s => s.session_number === sessionNum);
                const isUploading = uploadingSession === sessionNum;

                return (
                  <Card key={sessionNum} className="relative overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold">ครั้งที่ {sessionNum}</h3>
                        {session && getStatusBadge(session.status)}
                      </div>

                      {session ? (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground truncate">{session.file_name}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => viewFile(session.file_url)}
                          >
                            ดูไฟล์
                          </Button>
                        </div>
                      ) : (
                        <div>
                          <input
                            type="file"
                            id={`upload-${sessionNum}`}
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(sessionNum, file);
                            }}
                            disabled={isUploading}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => document.getElementById(`upload-${sessionNum}`)?.click()}
                            disabled={isUploading}
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            {isUploading ? "กำลังอัปโหลด..." : "อัปโหลด"}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}