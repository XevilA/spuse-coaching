import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AppointmentCalendar } from "@/components/AppointmentCalendar";
import { AppointmentManager } from "@/components/AppointmentManager";
import { LINENotificationSender } from "@/components/LINENotificationSender";
import { AIAssistant } from "@/components/AIAssistant";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Calendar, MessageSquare, Users, ClipboardCheck } from "lucide-react";

const Teacher = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [roomBookings, setRoomBookings] = useState<any[]>([]);
  const [eventRequests, setEventRequests] = useState<any[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (roles?.role !== "teacher") {
        navigate("/");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

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
      const { data: sessionsData } = await supabase
        .from("coaching_sessions")
        .select(`
          *,
          student:profiles!coaching_sessions_student_id_fkey(first_name, last_name, student_id)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      setSessions(sessionsData || []);

      const { data: leaveData } = await supabase
        .from("leave_requests")
        .select(`
          *,
          student:profiles!leave_requests_student_id_fkey(first_name, last_name, student_id)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      setLeaveRequests(leaveData || []);

      const { data: roomData } = await supabase
        .from("room_bookings")
        .select(`
          *,
          student:profiles!room_bookings_student_id_fkey(first_name, last_name, student_id)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      setRoomBookings(roomData || []);

      const { data: eventData } = await supabase
        .from("event_requests")
        .select(`
          *,
          student:profiles!event_requests_student_id_fkey(first_name, last_name, student_id)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      setEventRequests(eventData || []);
    } catch (error: any) {
      console.error("Error fetching data:", error);
    }
  };

  const handleApproveSession = async (sessionId: string, action: "approved" | "rejected") => {
    try {
      const { error } = await supabase
        .from("coaching_sessions")
        .update({
          status: action,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
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
    action: "approved" | "rejected"
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

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <DashboardLayout role="teacher" userName={`${profile?.first_name} ${profile?.last_name}`}>
      <div className="space-y-6">
        <Tabs defaultValue="coaching" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="coaching">
              <FileText className="h-4 w-4 mr-2" />
              Coaching
            </TabsTrigger>
            <TabsTrigger value="calendar">
              <Calendar className="h-4 w-4 mr-2" />
              ปฏิทิน
            </TabsTrigger>
            <TabsTrigger value="appointments">
              <MessageSquare className="h-4 w-4 mr-2" />
              นัดหมาย
            </TabsTrigger>
            <TabsTrigger value="leave">
              <ClipboardCheck className="h-4 w-4 mr-2" />
              คำขอลา
            </TabsTrigger>
            <TabsTrigger value="rooms">
              <Users className="h-4 w-4 mr-2" />
              จองห้อง
            </TabsTrigger>
            <TabsTrigger value="events">
              <Users className="h-4 w-4 mr-2" />
              จัดงาน
            </TabsTrigger>
          </TabsList>

          <TabsContent value="coaching" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>รอตรวจสอบใบ Coaching</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sessions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      ไม่มีใบ coaching ที่รอตรวจสอบ
                    </p>
                  ) : (
                    sessions.map((session) => (
                      <div key={session.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">
                              {session.student?.first_name} {session.student?.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {session.student?.student_id} - ครั้งที่ {session.session_number}
                            </p>
                          </div>
                          <Badge variant="secondary">รอตรวจสอบ</Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => viewFile(session.file_url)}
                          >
                            ดูไฟล์
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleApproveSession(session.id, "approved")}
                          >
                            อนุมัติ
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleApproveSession(session.id, "rejected")}
                          >
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

          <TabsContent value="calendar">
            <AppointmentCalendar role="teacher" userId={user?.id || ""} />
          </TabsContent>

          <TabsContent value="appointments">
            <AppointmentManager role="teacher" userId={user?.id || ""} />
          </TabsContent>

          <TabsContent value="leave" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>คำขอลา</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {leaveRequests.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">ไม่มีคำขอลา</p>
                  ) : (
                    leaveRequests.map((request) => (
                      <div key={request.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">
                              {request.student?.first_name} {request.student?.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {request.leave_type === "sick" ? "ลาป่วย" : request.leave_type === "personal" ? "ลากิจ" : "อื่นๆ"}
                            </p>
                          </div>
                          <Badge variant="secondary">รอตรวจสอบ</Badge>
                        </div>
                        <div>
                          <p className="text-sm">
                            <strong>วันที่:</strong> {new Date(request.start_date).toLocaleDateString("th-TH")} -{" "}
                            {new Date(request.end_date).toLocaleDateString("th-TH")}
                          </p>
                          <p className="text-sm mt-1">
                            <strong>เหตุผล:</strong> {request.reason}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleReviewRequest("leave_requests", request.id, "approved")}
                          >
                            อนุมัติ
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReviewRequest("leave_requests", request.id, "rejected")}
                          >
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

          <TabsContent value="rooms" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>คำขอจองห้อง</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {roomBookings.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">ไม่มีคำขอจองห้อง</p>
                  ) : (
                    roomBookings.map((booking) => (
                      <div key={booking.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">
                              {booking.student?.first_name} {booking.student?.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">{booking.room_name}</p>
                          </div>
                          <Badge variant="secondary">รอตรวจสอบ</Badge>
                        </div>
                        <div>
                          <p className="text-sm">
                            <strong>วันที่:</strong> {new Date(booking.booking_date).toLocaleDateString("th-TH")}
                          </p>
                          <p className="text-sm">
                            <strong>เวลา:</strong> {booking.start_time} - {booking.end_time}
                          </p>
                          <p className="text-sm mt-1">
                            <strong>วัตถุประสงค์:</strong> {booking.purpose}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleReviewRequest("room_bookings", booking.id, "approved")}
                          >
                            อนุมัติ
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReviewRequest("room_bookings", booking.id, "rejected")}
                          >
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

          <TabsContent value="events" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>คำขอจัดกิจกรรม</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {eventRequests.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">ไม่มีคำขอจัดกิจกรรม</p>
                  ) : (
                    eventRequests.map((event) => (
                      <div key={event.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{event.event_name}</p>
                            <p className="text-sm text-muted-foreground">
                              โดย {event.student?.first_name} {event.student?.last_name}
                            </p>
                          </div>
                          <Badge variant="secondary">รอตรวจสอบ</Badge>
                        </div>
                        <div>
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
                          <p className="text-sm mt-1">
                            <strong>รายละเอียด:</strong> {event.description}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleReviewRequest("event_requests", event.id, "approved")}
                          >
                            อนุมัติ
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReviewRequest("event_requests", event.id, "rejected")}
                          >
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
        </Tabs>

        <LINENotificationSender userId={user?.id || ""} role="teacher" />
      </div>

      <AIAssistant />
      <Footer />
    </DashboardLayout>
  );
};

export default Teacher;
