import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AppointmentManager } from "@/components/AppointmentManager";
import { LeaveRequestForm } from "@/components/LeaveRequestForm";
import { RoomBookingForm } from "@/components/RoomBookingForm";
import { EventRequestForm } from "@/components/EventRequestForm";
import { AIAssistant } from "@/components/AIAssistant";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  User,
  Calendar,
  FileCheck,
  Building,
  Sparkles,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

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

    const channel = supabase
      .channel("student-sessions-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "coaching_sessions",
          filter: `student_id=eq.${user.id}`,
        },
        () => {
          if (user?.id) fetchData(user.id);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).single();

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

      const { error: dbError } = await supabase.from("coaching_sessions").upsert({
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

    const pendingSessions = sessions.filter((s) => s.status === "pending" && s.file_url);

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
        .in(
          "id",
          pendingSessions.map((s) => s.id),
        );

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
      const { data, error } = await supabase.storage.from("coaching-forms").createSignedUrl(fileUrl, 60);

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

  const completedSessions = sessions.filter((s) => s.status === "approved").length;
  const progressPercentage = (completedSessions / minSessions) * 100;

  const getStatusBadge = (status: string) => {
    if (status === "approved") {
      return (
        <Badge className="bg-gradient-to-r from-red-500 to-red-600 text-white border-0 shadow-sm">
          <CheckCircle className="w-3 h-3 mr-1" />
          อนุมัติ
        </Badge>
      );
    }
    if (status === "rejected") {
      return (
        <Badge className="bg-gray-500 text-white border-0">
          <XCircle className="w-3 h-3 mr-1" />
          ไม่อนุมัติ
        </Badge>
      );
    }
    return (
      <Badge className="bg-orange-100 text-orange-700 border-0">
        <Clock className="w-3 h-3 mr-1" />
        รอตรวจสอบ
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <DashboardLayout role="student" userName="">
        <div className="space-y-8 animate-in fade-in duration-500">
          {/* Profile Card Skeleton */}
          <Card className="overflow-hidden bg-gradient-to-br from-white to-gray-50 shadow-xl border-0">
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <Skeleton className="h-12 w-64 mx-auto" />
                <Skeleton className="h-8 w-32 mx-auto" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="text-center space-y-2">
                    <Skeleton className="h-4 w-20 mx-auto" />
                    <Skeleton className="h-8 w-24 mx-auto" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Progress Card Skeleton */}
          <Card className="shadow-lg border-0">
            <CardContent className="p-8">
              <Skeleton className="h-6 w-32 mb-4" />
              <Skeleton className="h-3 w-full" />
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="student" userName={`${profile?.first_name} ${profile?.last_name}`}>
      <div className="space-y-8 animate-in fade-in duration-500">
        {/* Profile Card - Apple Style */}
        <Card className="overflow-hidden bg-gradient-to-br from-white via-red-50/30 to-white shadow-2xl border-0 hover:shadow-3xl transition-all duration-500">
          <CardContent className="p-0">
            {/* Red Accent Bar */}
            <div className="h-2 bg-gradient-to-r from-red-500 via-red-600 to-red-500"></div>

            <div className="p-8 md:p-12">
              <div className="text-center space-y-6">
                {/* Avatar Circle with Red Gradient */}
                <div className="relative inline-block">
                  <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white shadow-lg">
                    <User className="w-12 h-12" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                    <Sparkles className="w-4 h-4 text-red-500" />
                  </div>
                </div>

                {/* Name and ID */}
                <div className="space-y-3">
                  <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-gray-900 via-red-900 to-gray-900 bg-clip-text text-transparent tracking-tight">
                    {profile?.first_name} {profile?.last_name}
                  </h1>
                  <div className="inline-flex items-center justify-center px-6 py-2 bg-red-50 rounded-full">
                    <p className="text-2xl font-semibold text-red-600">{profile?.student_id || "-"}</p>
                  </div>
                </div>
              </div>

              {/* Info Grid - Apple Style */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10 pt-10 border-t border-gray-100">
                <div className="text-center group cursor-default">
                  <div className="inline-flex items-center justify-center w-12 h-12 mb-3 rounded-full bg-red-50 group-hover:bg-red-100 transition-colors">
                    <Calendar className="w-6 h-6 text-red-600" />
                  </div>
                  <p className="text-sm text-gray-500 mb-2 font-medium">ชั้นปี</p>
                  <p className="text-3xl font-bold text-gray-900">{profile?.year_level || "-"}</p>
                </div>

                <div className="text-center group cursor-default">
                  <div className="inline-flex items-center justify-center w-12 h-12 mb-3 rounded-full bg-red-50 group-hover:bg-red-100 transition-colors">
                    <FileCheck className="w-6 h-6 text-red-600" />
                  </div>
                  <p className="text-sm text-gray-500 mb-2 font-medium">สาขา</p>
                  <p className="text-2xl font-bold text-gray-900">{profile?.major || "-"}</p>
                </div>

                <div className="text-center group cursor-default">
                  <div className="inline-flex items-center justify-center w-12 h-12 mb-3 rounded-full bg-red-50 group-hover:bg-red-100 transition-colors">
                    <User className="w-6 h-6 text-red-600" />
                  </div>
                  <p className="text-sm text-gray-500 mb-2 font-medium">อีเมล</p>
                  <p className="text-lg font-semibold text-gray-700 break-all">{profile?.email}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs - Apple Style */}
        <Tabs defaultValue="coaching" className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-14 p-1 bg-gray-100 rounded-2xl shadow-inner">
            <TabsTrigger
              value="coaching"
              className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300"
            >
              <FileText className="w-4 h-4 mr-2" />
              Coaching
            </TabsTrigger>
            <TabsTrigger
              value="appointment"
              className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300"
            >
              <Calendar className="w-4 h-4 mr-2" />
              นัดหมาย
            </TabsTrigger>
            <TabsTrigger
              value="leave"
              className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300"
            >
              <FileCheck className="w-4 h-4 mr-2" />
              ยื่นลา
            </TabsTrigger>
            <TabsTrigger
              value="room"
              className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300"
            >
              <Building className="w-4 h-4 mr-2" />
              จองห้อง
            </TabsTrigger>
            <TabsTrigger
              value="event"
              className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              กิจกรรม
            </TabsTrigger>
          </TabsList>

          <TabsContent value="coaching" className="space-y-6 mt-6 animate-in fade-in duration-300">
            {/* Progress Card - Apple Style */}
            <Card className="overflow-hidden bg-gradient-to-br from-white to-red-50/20 shadow-xl border-0 hover:shadow-2xl transition-all duration-500">
              <CardContent className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">ความคืบหน้า</h2>
                    <p className="text-gray-600">
                      จำนวนครั้งที่ผ่าน: <span className="font-bold text-red-600">{completedSessions}</span> /{" "}
                      {minSessions} ครั้ง
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-5xl font-bold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent">
                      {Math.round(progressPercentage)}%
                    </div>
                    <p className="text-sm text-gray-500 mt-1">ความสำเร็จ</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                    <div
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-500 via-red-600 to-red-500 rounded-full transition-all duration-1000 ease-out shadow-lg"
                      style={{ width: `${progressPercentage}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </div>
                  </div>

                  {completedSessions >= minSessions ? (
                    <Alert className="bg-gradient-to-r from-red-50 to-red-100 border-red-200">
                      <CheckCircle className="h-5 w-5 text-red-600" />
                      <AlertDescription className="text-red-900 font-semibold">
                        🎉 ยินดีด้วย! คุณทำครบจำนวนครั้งที่กำหนดแล้ว
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <p className="text-center text-gray-600 font-medium">
                      อีก <span className="text-red-600 font-bold text-lg">{minSessions - completedSessions}</span>{" "}
                      ครั้งเพื่อครบตามเกณฑ์
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Upload Card - Apple Style */}
            <Card className="overflow-hidden shadow-xl border-0">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-gray-900">อัปโหลดใบ Coaching</CardTitle>
                      <CardDescription className="text-gray-600">อัปโหลดใบ coaching ของแต่ละครั้ง</CardDescription>
                    </div>
                  </div>
                  <Button
                    onClick={handleSubmitAll}
                    disabled={sessions.filter((s) => s.status === "pending" && s.file_url).length === 0}
                    className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-6 disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    ส่งทั้งหมด
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {sessions.length === 0 && (
                  <Alert className="mb-6 border-red-100 bg-red-50">
                    <FileText className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      ยังไม่มีไฟล์ที่อัปโหลด เริ่มต้นโดยการอัปโหลดใบ coaching ครั้งแรกของคุณ
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {Array.from({ length: minSessions }, (_, i) => i + 1).map((sessionNum) => {
                    const session = sessions.find((s) => s.session_number === sessionNum);
                    const isUploading = uploadingSession === sessionNum;

                    return (
                      <Card
                        key={sessionNum}
                        className={cn(
                          "relative overflow-hidden transition-all duration-300 hover:shadow-xl border-0",
                          session?.status === "approved"
                            ? "bg-gradient-to-br from-red-50 to-white shadow-lg ring-2 ring-red-200"
                            : session?.status === "rejected"
                              ? "bg-gray-50 shadow-md"
                              : session
                                ? "bg-orange-50 shadow-md"
                                : "bg-white shadow-md hover:bg-gray-50",
                        )}
                      >
                        {/* Status Indicator Bar */}
                        {session && (
                          <div
                            className={cn(
                              "absolute top-0 left-0 right-0 h-1",
                              session.status === "approved" && "bg-gradient-to-r from-red-500 to-red-600",
                              session.status === "rejected" && "bg-gray-400",
                              session.status === "pending" && "bg-orange-400",
                            )}
                          />
                        )}

                        <CardContent className="p-5">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <div
                                className={cn(
                                  "w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg",
                                  session?.status === "approved"
                                    ? "bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg"
                                    : "bg-gray-100 text-gray-600",
                                )}
                              >
                                {sessionNum}
                              </div>
                              <span className="font-semibold text-gray-700">ครั้งที่ {sessionNum}</span>
                            </div>
                            {session && getStatusBadge(session.status)}
                          </div>

                          {session ? (
                            <div className="space-y-3">
                              <div className="p-3 bg-white rounded-lg border border-gray-100">
                                <p className="text-sm text-gray-600 truncate font-medium">{session.file_name}</p>
                              </div>
                              {session.teacher_comment && (
                                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                  <p className="text-xs font-semibold text-blue-900 mb-1">ความคิดเห็นจากอาจารย์:</p>
                                  <p className="text-sm text-blue-800">{session.teacher_comment}</p>
                                </div>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full rounded-lg border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 transition-all duration-300"
                                onClick={() => viewFile(session.file_url)}
                              >
                                <FileText className="w-4 h-4 mr-2" />
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
                                size="sm"
                                className={cn(
                                  "w-full rounded-lg transition-all duration-300 shadow-md",
                                  isUploading
                                    ? "bg-gray-300 cursor-not-allowed"
                                    : "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white hover:shadow-lg",
                                )}
                                onClick={() => document.getElementById(`upload-${sessionNum}`)?.click()}
                                disabled={isUploading}
                              >
                                {isUploading ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    กำลังอัปโหลด...
                                  </>
                                ) : (
                                  <>
                                    <Upload className="w-4 h-4 mr-2" />
                                    อัปโหลด
                                  </>
                                )}
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
          </TabsContent>

          <TabsContent value="appointment" className="mt-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-xl border-0 p-6">
              <AppointmentManager role="student" userId={user?.id || ""} />
            </div>
          </TabsContent>

          <TabsContent value="leave" className="mt-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-xl border-0 p-6">
              <LeaveRequestForm userId={user?.id || ""} />
            </div>
          </TabsContent>

          <TabsContent value="room" className="mt-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-xl border-0 p-6">
              <RoomBookingForm userId={user?.id || ""} />
            </div>
          </TabsContent>

          <TabsContent value="event" className="mt-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-xl border-0 p-6">
              <EventRequestForm userId={user?.id || ""} />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <AIAssistant />
      <Footer />
    </DashboardLayout>
  );
}
