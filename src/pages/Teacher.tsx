import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AppointmentCalendar } from "@/components/AppointmentCalendar";
import { AppointmentManager } from "@/components/AppointmentManager";
import { AIAssistant } from "@/components/AIAssistant";
import { Footer } from "@/components/Footer";
import { LINENotificationSender } from "@/components/LINENotificationSender";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  FileText,
  Calendar as CalendarIcon,
  MessageSquare,
  Users as UsersIcon,
  ClipboardCheck,
  Send,
  MessageCircle,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  Eye,
  BookOpen,
} from "lucide-react";

const Teacher = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [roomBookings, setRoomBookings] = useState<any[]>([]);
  const [eventRequests, setEventRequests] = useState<any[]>([]);
  const [lineChannels, setLineChannels] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [sessionComment, setSessionComment] = useState("");
  const [lineMessage, setLineMessage] = useState({
    channelId: "",
    message: "",
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Setup realtime subscriptions
    const channel = supabase
      .channel("teacher-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "coaching_sessions" }, () => {
        if (user?.id) fetchData(user.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, () => {
        if (user?.id) fetchData(user.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_bookings" }, () => {
        if (user?.id) fetchData(user.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "event_requests" }, () => {
        if (user?.id) fetchData(user.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const checkAuth = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single();

      if (roles?.role !== "teacher") {
        navigate("/");
        return;
      }

      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).single();

      setUser(user);
      setProfile(profileData);
      fetchData(user.id);
    } catch (error) {
      console.error("Error checking auth:", error);
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async (teacherId: string) => {
    try {
      const [sessionsRes, leaveRes, roomRes, eventRes, lineRes, assignmentsRes, allSessionsRes] = await Promise.all([
        supabase
          .from("coaching_sessions")
          .select(
            `
            *,
            student:profiles!coaching_sessions_student_id_fkey(first_name, last_name, student_id, group_id)
          `,
          )
          .eq("status", "pending")
          .order("created_at", { ascending: false }),

        supabase
          .from("leave_requests")
          .select(
            `
            *,
            student:profiles!leave_requests_student_id_fkey(first_name, last_name, student_id)
          `,
          )
          .eq("status", "pending")
          .order("created_at", { ascending: false }),

        supabase
          .from("room_bookings")
          .select(
            `
            *,
            student:profiles!room_bookings_student_id_fkey(first_name, last_name, student_id)
          `,
          )
          .eq("status", "pending")
          .order("created_at", { ascending: false }),

        supabase
          .from("event_requests")
          .select(
            `
            *,
            student:profiles!event_requests_student_id_fkey(first_name, last_name, student_id)
          `,
          )
          .eq("status", "pending")
          .order("created_at", { ascending: false }),

        supabase.from("line_notifications").select("*").eq("enabled", true),
        
        // Fetch teacher's group assignments
        supabase
          .from("teacher_assignments")
          .select(`
            *,
            student_groups(name, required_sessions)
          `)
          .eq("teacher_id", teacherId),
          
        // Fetch all coaching sessions for teacher's groups
        supabase
          .from("coaching_sessions")
          .select(`
            *,
            student:profiles!coaching_sessions_student_id_fkey(first_name, last_name, student_id, group_id)
          `)
          .order("created_at", { ascending: false }),
      ]);

      setSessions(sessionsRes.data || []);
      setLeaveRequests(leaveRes.data || []);
      setRoomBookings(roomRes.data || []);
      setEventRequests(eventRes.data || []);
      setLineChannels(lineRes.data || []);
      
      // Set teacher assignments and calculate stats
      if (assignmentsRes.data) {
        const groupIds = assignmentsRes.data.map(a => a.group_id);
        const teacherSessions = (allSessionsRes.data || []).filter((s: any) => 
          groupIds.includes(s.student?.group_id)
        );
        
        setProfile((prev: any) => ({
          ...prev,
          teacherAssignments: assignmentsRes.data,
          totalGroups: assignmentsRes.data.length,
          totalSessions: teacherSessions.length,
          approvedSessions: teacherSessions.filter((s: any) => s.status === "approved").length,
          pendingSessions: teacherSessions.filter((s: any) => s.status === "pending").length,
        }));
      }
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถโหลดข้อมูลได้",
      });
    }
  };

  const handleApproveSession = async (sessionId: string, action: "approved" | "rejected", comment?: string) => {
    try {
      const updateData: any = {
        status: action,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      };
      
      if (comment) {
        updateData.teacher_comment = comment;
      }
      
      const { error } = await supabase
        .from("coaching_sessions")
        .update(updateData)
        .eq("id", sessionId);

      if (error) throw error;

      toast({
        title: "สำเร็จ",
        description: `${action === "approved" ? "อนุมัติ" : "ไม่อนุมัติ"}ใบ coaching แล้ว`,
      });

      fetchData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    }
  };

  const handleReviewRequest = async (
    table: "leave_requests" | "room_bookings" | "event_requests",
    requestId: string,
    action: "approved" | "rejected",
  ) => {
    try {
      const { error } = await supabase
        .from(table)
        .update({
          status: action,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: "สำเร็จ",
        description: `${action === "approved" ? "อนุมัติ" : "ไม่อนุมัติ"}คำขอแล้ว`,
      });

      fetchData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    }
  };

  const handleSendLineMessage = async () => {
    // This function is replaced by LINENotificationSender component
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

  if (loading) {
    return (
      <DashboardLayout role="teacher" userName="">
        <div className="space-y-6">
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const pendingCount = sessions.length + leaveRequests.length + roomBookings.length + eventRequests.length;

  return (
    <DashboardLayout role="teacher" userName={`${profile?.first_name || ""} ${profile?.last_name || ""}`}>
      <div className="space-y-6 animate-in fade-in duration-500">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="hover:shadow-lg transition-shadow duration-300 border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">กลุ่มที่ดูแล</CardTitle>
              <UsersIcon className="w-5 h-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{profile?.totalGroups || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">กลุ่มเรียน</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300 border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Coaching ทั้งหมด</CardTitle>
              <BookOpen className="w-5 h-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{profile?.totalSessions || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">อนุมัติแล้ว {profile?.approvedSessions || 0}</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300 border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Coaching รอตรวจ</CardTitle>
              <FileText className="w-5 h-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{sessions.length}</div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300 border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">คำขอต่างๆ</CardTitle>
              <ClipboardCheck className="w-5 h-5 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{leaveRequests.length + roomBookings.length + eventRequests.length}</div>
              <p className="text-xs text-muted-foreground mt-1">ลา+ห้อง+กิจกรรม</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300 border-l-4 border-l-red-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">รอพิจารณา</CardTitle>
              <Clock className="w-5 h-5 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{profile?.pendingSessions || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Coaching รอ</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="coaching" className="w-full">
          <TabsList className="grid w-full grid-cols-7 h-auto p-1">
            <TabsTrigger
              value="coaching"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <FileText className="h-4 w-4 mr-2" />
              Coaching
            </TabsTrigger>
            <TabsTrigger
              value="calendar"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <CalendarIcon className="h-4 w-4 mr-2" />
              ปฏิทิน
            </TabsTrigger>
            <TabsTrigger
              value="appointments"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              นัดหมาย
            </TabsTrigger>
            <TabsTrigger
              value="leave"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <ClipboardCheck className="h-4 w-4 mr-2" />
              คำขอลา
            </TabsTrigger>
            <TabsTrigger
              value="rooms"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <UsersIcon className="h-4 w-4 mr-2" />
              จองห้อง
            </TabsTrigger>
            <TabsTrigger
              value="events"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <CalendarIcon className="h-4 w-4 mr-2" />
              จัดงาน
            </TabsTrigger>
            <TabsTrigger
              value="line"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              LINE
            </TabsTrigger>
          </TabsList>

          <TabsContent value="coaching" className="space-y-4 animate-in fade-in duration-300">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  รอตรวจสอบใบ Coaching
                </CardTitle>
                <CardDescription>มีใบ coaching รอตรวจสอบ {sessions.length} รายการ</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sessions.length === 0 ? (
                    <Alert>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <AlertDescription>ไม่มีใบ coaching ที่รอตรวจสอบ</AlertDescription>
                    </Alert>
                  ) : (
                    sessions.map((session) => (
                      <div
                        key={session.id}
                        className="border rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-lg">
                              {session.student?.first_name} {session.student?.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {session.student?.student_id} - ครั้งที่ {session.session_number}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              ส่งเมื่อ: {new Date(session.created_at).toLocaleString("th-TH")}
                            </p>
                          </div>
                          <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                            <Clock className="w-3 h-3 mr-1" />
                            รอตรวจสอบ
                          </Badge>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Button size="sm" variant="outline" onClick={() => viewFile(session.file_url)}>
                            <Eye className="w-4 h-4 mr-2" />
                            ดูไฟล์
                          </Button>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => {
                              setCurrentSession({ ...session, status: "approved" });
                              setCommentDialogOpen(true);
                            }}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            อนุมัติ
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setCurrentSession({ ...session, status: "rejected" });
                              setCommentDialogOpen(true);
                            }}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            ไม่อนุมัติ
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calendar" className="animate-in fade-in duration-300">
            <AppointmentCalendar role="teacher" userId={user?.id || ""} />
          </TabsContent>

          <TabsContent value="appointments" className="animate-in fade-in duration-300">
            <AppointmentManager role="teacher" userId={user?.id || ""} />
          </TabsContent>

          <TabsContent value="leave" className="space-y-4 animate-in fade-in duration-300">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5" />
                  คำขอลา
                </CardTitle>
                <CardDescription>มีคำขอลารอตรวจสอบ {leaveRequests.length} รายการ</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {leaveRequests.length === 0 ? (
                    <Alert>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <AlertDescription>ไม่มีคำขอลา</AlertDescription>
                    </Alert>
                  ) : (
                    leaveRequests.map((request) => (
                      <div
                        key={request.id}
                        className="border rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-lg">
                              {request.student?.first_name} {request.student?.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {request.leave_type === "sick"
                                ? "ลาป่วย"
                                : request.leave_type === "personal"
                                  ? "ลากิจ"
                                  : "อื่นๆ"}
                            </p>
                          </div>
                          <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                            <Clock className="w-3 h-3 mr-1" />
                            รอตรวจสอบ
                          </Badge>
                        </div>
                        <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                          <p className="text-sm">
                            <strong>วันที่:</strong> {new Date(request.start_date).toLocaleDateString("th-TH")} -{" "}
                            {new Date(request.end_date).toLocaleDateString("th-TH")}
                          </p>
                          <p className="text-sm">
                            <strong>เหตุผล:</strong> {request.reason}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleReviewRequest("leave_requests", request.id, "approved")}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            อนุมัติ
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReviewRequest("leave_requests", request.id, "rejected")}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            ไม่อนุมัติ
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rooms" className="space-y-4 animate-in fade-in duration-300">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UsersIcon className="w-5 h-5" />
                  คำขอจองห้อง
                </CardTitle>
                <CardDescription>มีคำขอจองห้องรอตรวจสอบ {roomBookings.length} รายการ</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {roomBookings.length === 0 ? (
                    <Alert>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <AlertDescription>ไม่มีคำขอจองห้อง</AlertDescription>
                    </Alert>
                  ) : (
                    roomBookings.map((booking) => (
                      <div
                        key={booking.id}
                        className="border rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-lg">
                              {booking.student?.first_name} {booking.student?.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">{booking.room_name}</p>
                          </div>
                          <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                            <Clock className="w-3 h-3 mr-1" />
                            รอตรวจสอบ
                          </Badge>
                        </div>
                        <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                          <p className="text-sm">
                            <strong>วันที่:</strong> {new Date(booking.booking_date).toLocaleDateString("th-TH")}
                          </p>
                          <p className="text-sm">
                            <strong>เวลา:</strong> {booking.start_time} - {booking.end_time}
                          </p>
                          <p className="text-sm">
                            <strong>วัตถุประสงค์:</strong> {booking.purpose}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleReviewRequest("room_bookings", booking.id, "approved")}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            อนุมัติ
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReviewRequest("room_bookings", booking.id, "rejected")}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            ไม่อนุมัติ
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events" className="space-y-4 animate-in fade-in duration-300">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5" />
                  คำขอจัดกิจกรรม
                </CardTitle>
                <CardDescription>มีคำขอจัดกิจกรรมรอตรวจสอบ {eventRequests.length} รายการ</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {eventRequests.length === 0 ? (
                    <Alert>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <AlertDescription>ไม่มีคำขอจัดกิจกรรม</AlertDescription>
                    </Alert>
                  ) : (
                    eventRequests.map((event) => (
                      <div key={event.id} className="border rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-lg">{event.event_name}</p>
                            <p className="text-sm text-muted-foreground">
                              โดย {event.student?.first_name} {event.student?.last_name}
                            </p>
                          </div>
                          <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                            <Clock className="w-3 h-3 mr-1" />
                            รอตรวจสอบ
                          </Badge>
                        </div>
                        <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                          <p className="text-sm">
                            <strong>ประเภท:</strong> {event.event_type}
                          </p>
                          <p className="text-sm">
                            <strong>วันที่:</strong> {new Date(event.event_date).toLocaleDateString("th-TH")}
                          </p>
                          <p className="text-sm">
                            <strong>เวลา:</strong> {event.start_time} - {event.end_time}
                          </p>
                          <p className="text-sm">
                            <strong>สถานที่:</strong> {event.location || "-"}
                          </p>
                          <p className="text-sm">
                            <strong>ผู้เข้าร่วม:</strong> {event.expected_participants || "-"} คน
                          </p>
                          <p className="text-sm">
                            <strong>รายละเอียด:</strong> {event.description}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleReviewRequest("event_requests", event.id, "approved")}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            อนุมัติ
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReviewRequest("event_requests", event.id, "rejected")}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            ไม่อนุมัติ
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="line" className="space-y-4 animate-in fade-in duration-300">
            <LINENotificationSender userId={user?.id || ""} role="teacher" />
          </TabsContent>
        </Tabs>
        
        {/* Comment Dialog */}
        <Dialog open={commentDialogOpen} onOpenChange={setCommentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {currentSession?.status === "approved" ? "อนุมัติใบ Coaching" : "ไม่อนุมัติใบ Coaching"}
              </DialogTitle>
              <DialogDescription>
                {currentSession?.student && (
                  <span>
                    นักศึกษา: {currentSession.student.first_name} {currentSession.student.last_name} (
                    {currentSession.student.student_id}) - ครั้งที่ {currentSession.session_number}
                  </span>
                )}
                <br />
                เพิ่มความคิดเห็นสำหรับนักศึกษา (ไม่บังคับ)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="comment">ความคิดเห็นของอาจารย์</Label>
                <Textarea
                  id="comment"
                  placeholder="พิมพ์ความคิดเห็นหรือข้อเสนอแนะ..."
                  value={sessionComment}
                  onChange={(e) => setSessionComment(e.target.value)}
                  rows={5}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCommentDialogOpen(false);
                  setSessionComment("");
                  setCurrentSession(null);
                }}
              >
                ยกเลิก
              </Button>
              <Button
                onClick={() => {
                  const action = currentSession?.status === "approved" ? "approved" : "rejected";
                  handleApproveSession(currentSession?.id, action, sessionComment);
                  setCommentDialogOpen(false);
                  setSessionComment("");
                  setCurrentSession(null);
                }}
                className={currentSession?.status === "approved" ? "bg-green-600 hover:bg-green-700" : ""}
                variant={currentSession?.status === "rejected" ? "destructive" : "default"}
              >
                ยืนยัน{currentSession?.status === "approved" ? "อนุมัติ" : "ไม่อนุมัติ"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <AIAssistant />
      <Footer />
    </DashboardLayout>
  );
};

export default Teacher;
