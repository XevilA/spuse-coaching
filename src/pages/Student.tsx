import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileCheck, Calendar, User, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Student() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [requiredSessions, setRequiredSessions] = useState(10);
  const [sessionNumber, setSessionNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [teachers, setTeachers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("student-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "coaching_sessions" }, () => {
        if (user?.id) fetchData(user.id);
      })
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
      const [profileRes, sessionsRes, settingsRes, teachersRes, groupsRes, assignmentsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("coaching_sessions").select("*").eq("student_id", userId).order("created_at", { ascending: false }),
        supabase.from("coaching_settings").select("*").eq("key", "min_sessions").single(),
        supabase.from("profiles").select("id, first_name, last_name").in("id", 
          (await supabase.from("user_roles").select("user_id").eq("role", "teacher")).data?.map(r => r.user_id) || []
        ),
        supabase.from("student_groups").select("*"),
        supabase.from("teacher_assignments").select("teacher_id, group_id"),
      ]);

      if (profileRes.data) {
        setProfile(profileRes.data);
        setSelectedGroup(profileRes.data.group_id || "");
      }
      if (sessionsRes.data) setSessions(sessionsRes.data);
      if (settingsRes.data) setRequiredSessions(parseInt(settingsRes.data.value));
      if (teachersRes.data) setTeachers(teachersRes.data);
      if (groupsRes.data) setGroups(groupsRes.data);
      if (assignmentsRes.data) setTeacherAssignments(assignmentsRes.data);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveGroup = async (groupId: string) => {
    if (!user) return;
    
    setIsSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ group_id: groupId })
        .eq("id", user.id);

      if (error) throw error;

      // Add to group_members table
      const { error: memberError } = await supabase
        .from("group_members")
        .upsert(
          { student_id: user.id, group_id: groupId },
          { onConflict: 'student_id', ignoreDuplicates: false }
        );

      if (memberError) {
        console.error("Group member error:", memberError);
      }

      setSelectedGroup(groupId);
      setProfile({ ...profile, group_id: groupId });

      toast({
        title: "บันทึกสำเร็จ",
        description: "บันทึกกลุ่มเรียนของคุณแล้ว",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUploadSession = async () => {
    if (!file || !sessionNumber || !user || !selectedTeacher) {
      toast({
        variant: "destructive",
        title: "กรุณากรอกข้อมูลให้ครบถ้วน",
        description: "กรุณาเลือกอาจารย์และหมายเลขครั้งที่",
      });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from("coaching-forms").upload(fileName, file);

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("coaching_sessions").insert({
        student_id: user.id,
        teacher_id: selectedTeacher,
        group_id: selectedGroup || null,
        session_number: parseInt(sessionNumber),
        file_url: uploadData.path,
        file_name: file.name,
        status: "pending",
      });

      if (insertError) throw insertError;

      toast({
        title: "อัปโหลดสำเร็จ",
        description: "ส่งใบ Coaching แล้ว (รอการยืนยันจากอาจารย์)",
      });

      setFile(null);
      setSessionNumber("");
      setSelectedTeacher("");
      fetchData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "อัปโหลดล้มเหลว",
        description: error.message,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const viewFile = async (fileUrl: string) => {
    try {
      const { data, error } = await supabase.storage.from("coaching-forms").createSignedUrl(fileUrl, 60);
      if (error) throw error;
      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "ไม่สามารถเปิดไฟล์ได้",
        description: error.message,
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      approved: <Badge className="bg-green-500"><FileCheck className="w-3 h-3 mr-1" />อนุมัติ</Badge>,
      rejected: <Badge variant="destructive">ไม่อนุมัติ</Badge>,
      pending: <Badge variant="secondary">รอยืนยัน</Badge>,
    };
    return badges[status as keyof typeof badges] || badges.pending;
  };

  const completedSessions = sessions.filter((s) => s.status === "approved").length;
  const progressPercentage = (completedSessions / requiredSessions) * 100;

  // Show all teachers or filtered by group
  const availableTeachers = selectedGroup
    ? teachers.filter((teacher) => 
        teacherAssignments.some(
          (assignment) => assignment.teacher_id === teacher.id && assignment.group_id === selectedGroup
        )
      )
    : teachers;

  if (isLoading) return (
    <DashboardLayout role="student" userName="">
      <div className="flex items-center justify-center h-screen">
        <p>กำลังโหลด...</p>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout role="student" userName={`${profile?.first_name} ${profile?.last_name}`}>
      <div className="space-y-6 p-4 sm:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl">ข้อมูลส่วนตัว</CardTitle>
            <CardDescription>เลือกกลุ่มเรียนของคุณ</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>ชื่อ-นามสกุล</Label>
                <Input value={`${profile?.first_name} ${profile?.last_name}`} disabled className="bg-muted" />
              </div>
              <div>
                <Label>รหัสนักศึกษา</Label>
                <Input value={profile?.student_id || "-"} disabled className="bg-muted" />
              </div>
            </div>
            <div>
              <Label htmlFor="studentGroup">กลุ่มเรียนของคุณ</Label>
              <div className="flex gap-2">
                <Select value={selectedGroup} onValueChange={handleSaveGroup}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="เลือกกลุ่มเรียนของคุณ" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name} - {group.major} ปี {group.year_level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isSavingProfile && <span className="text-sm text-muted-foreground">กำลังบันทึก...</span>}
              </div>
              {selectedGroup && (
                <p className="text-sm text-muted-foreground mt-2">
                  ✓ คุณอยู่กลุ่ม: {groups.find((g) => g.id === selectedGroup)?.name}
                </p>
              )}
              {!selectedGroup && (
                <p className="text-sm text-yellow-600 mt-2">⚠️ กรุณาเลือกกลุ่มเรียนของคุณก่อนอัปโหลดใบ Coaching</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl">ความคืบหน้า Coaching</CardTitle>
            <CardDescription>
              {completedSessions}/{requiredSessions} ครั้ง
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={progressPercentage} className="h-3" />
            <p className="text-center mt-2 text-sm">
              {Math.round(progressPercentage)}% เสร็จสมบูรณ์
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">อัปโหลดใบ Coaching</CardTitle>
            <CardDescription>
              เลือกอาจารย์ที่ปรึกษาและอัปโหลดใบ Coaching (กลุ่มเรียนเป็นตัวเลือก)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="teacher">เลือกอาจารย์ที่ปรึกษา <span className="text-red-500">*</span></Label>
                <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="เลือกอาจารย์" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {availableTeachers.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">
                        {selectedGroup ? "ไม่มีอาจารย์ในกลุ่มนี้" : "ไม่มีอาจารย์"}
                      </div>
                    ) : (
                      availableTeachers.map((teacher: any) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.first_name} {teacher.last_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {selectedGroup && (
                  <p className="text-xs text-muted-foreground mt-1">
                    แสดงอาจารย์จากกลุ่ม: {groups.find((g) => g.id === selectedGroup)?.name}
                  </p>
                )}
                {!selectedGroup && (
                  <p className="text-xs text-muted-foreground mt-1">
                    แสดงอาจารย์ทั้งหมด (เลือกกลุ่มเพื่อกรองอาจารย์)
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="sessionNumber">หมายเลขครั้งที่ <span className="text-red-500">*</span></Label>
                <Input
                  id="sessionNumber"
                  type="number"
                  value={sessionNumber}
                  onChange={(e) => setSessionNumber(e.target.value)}
                  placeholder="เช่น 1, 2, 3..."
                />
              </div>
              <div>
                <Label htmlFor="file">อัปโหลดไฟล์ PDF <span className="text-red-500">*</span></Label>
                <Input 
                  id="file" 
                  type="file" 
                  accept=".pdf" 
                  onChange={(e) => e.target.files && setFile(e.target.files[0])}
                />
              </div>
            </div>
            <Button onClick={handleUploadSession} disabled={isUploading} className="w-full sm:w-auto">
              <Upload className="w-4 h-4 mr-2" />
              {isUploading ? "กำลังอัปโหลด..." : "อัปโหลด"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">ประวัติการส่ง</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ครั้งที่</TableHead>
                    <TableHead>วันที่ส่ง</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>ความคิดเห็น</TableHead>
                    <TableHead>ไฟล์</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>#{session.session_number}</TableCell>
                      <TableCell className="text-sm">{new Date(session.created_at).toLocaleDateString("th-TH")}</TableCell>
                      <TableCell>{getStatusBadge(session.status)}</TableCell>
                      <TableCell className="max-w-xs truncate text-sm">
                        {session.teacher_comment || "-"}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => viewFile(session.file_url)}>
                          <Download className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
