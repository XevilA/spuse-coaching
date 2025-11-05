import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileCheck, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GroupMemberManager } from "@/components/GroupMemberManager";

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
  const [groups, setGroups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isLeader, setIsLeader] = useState(false);
  const [submissionType, setSubmissionType] = useState<"individual" | "group">("individual");
  const [availableTeachers, setAvailableTeachers] = useState<any[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("student-realtime-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "coaching_sessions", filter: `student_id=eq.${user.id}` }, () => {
        if (user?.id) fetchData(user.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` }, () => {
        if (user?.id) fetchData(user.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "student_groups" }, () => {
        if (user?.id) fetchData(user.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members", filter: `student_id=eq.${user.id}` }, () => {
        if (user?.id) fetchData(user.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, async () => {
        // Refetch teachers when user_roles changes
        await fetchTeachers();
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
      const [profileRes, sessionsRes, settingsRes, groupsRes, leaderRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("coaching_sessions").select("*").eq("student_id", userId).order("created_at", { ascending: false }),
        supabase.from("coaching_settings").select("*").eq("key", "min_sessions").single(),
        supabase.from("student_groups").select("*").order("name"),
        supabase.from("group_members").select("is_leader").eq("student_id", userId).maybeSingle(),
      ]);

      if (profileRes.data) {
        setProfile(profileRes.data);
        setSelectedGroup(profileRes.data.group_id || "");
      }
      if (sessionsRes.data) setSessions(sessionsRes.data);
      if (settingsRes.data) setRequiredSessions(parseInt(settingsRes.data.value));
      if (groupsRes.data) setGroups(groupsRes.data);
      if (leaderRes.data) setIsLeader(leaderRes.data.is_leader || false);

      // Fetch available teachers - CRITICAL
      await fetchTeachers();
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

  const fetchTeachers = async () => {
    try {
      // Get all teacher IDs from user_roles
      const { data: teacherRoles, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "teacher");

      if (roleError) throw roleError;

      if (teacherRoles && teacherRoles.length > 0) {
        const teacherIds = teacherRoles.map(r => r.user_id);
        
        // Get teacher profiles
        const { data: teacherProfiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", teacherIds);

        if (profileError) throw profileError;

        setAvailableTeachers(teacherProfiles || []);
      }
    } catch (error) {
      console.error("Error fetching teachers:", error);
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
      setSelectedTeacher("");

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

  const handleSubmit = async () => {
    if (!file || !sessionNumber) {
      toast({
        variant: "destructive",
        title: "กรุณากรอกข้อมูลให้ครบ",
        description: "กรุณาเลือกไฟล์และระบุครั้งที่",
      });
      return;
    }

    if (!selectedTeacher) {
      toast({
        variant: "destructive",
        title: "กรุณาเลือกอาจารย์",
        description: "กรุณาเลือกอาจารย์ที่ปรึกษาก่อนส่งใบ Coaching",
      });
      return;
    }

    if (submissionType === "group") {
      if (!selectedGroup) {
        toast({
          variant: "destructive",
          title: "กรุณาเลือกกลุ่ม",
          description: "กรุณาเลือกกลุ่มเรียนสำหรับการส่งแบบกลุ่ม",
        });
        return;
      }
      
      if (!isLeader) {
        toast({
          variant: "destructive",
          title: "ไม่มีสิทธิ์",
          description: "เฉพาะหัวหน้ากลุ่มเท่านั้นที่ส่งแบบกลุ่มได้",
        });
        return;
      }
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("coaching-forms")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const fileUrl = uploadData.path;

      const { error: sessionError } = await supabase.from("coaching_sessions").insert({
        student_id: user?.id,
        teacher_id: selectedTeacher,
        group_id: submissionType === "group" ? selectedGroup : null,
        session_number: parseInt(sessionNumber),
        file_url: fileUrl,
        file_name: file.name,
        status: "pending",
      });

      if (sessionError) throw sessionError;

      // Send LINE notification to teacher
      try {
        const teacherInfo = availableTeachers.find(t => t.id === selectedTeacher);
        const studentName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'นักศึกษา';
        const submissionTypeText = submissionType === "group" ? "กลุ่ม" : "ส่วนตัว";
        
        const notificationMessage = `🎓 การส่งงาน Coaching ใหม่
        
📝 รายละเอียด:
- นักศึกษา: ${studentName}${profile?.student_id ? ` (${profile.student_id})` : ''}
- ประเภท: ${submissionTypeText}
- ครั้งที่: ${sessionNumber}
- อาจารย์: ${teacherInfo?.first_name || ''} ${teacherInfo?.last_name || ''}
- วันที่ส่ง: ${new Date().toLocaleString('th-TH')}

⏳ รอการตรวจสอบ`;

        await supabase.functions.invoke("send-line-notification", {
          body: {
            message: notificationMessage,
            notificationType: "broadcast"
          },
        });
        console.log("LINE notification sent to teacher successfully");
      } catch (notifError) {
        console.error("Failed to send LINE notification:", notifError);
        // Don't throw error, just log it - notification failure shouldn't block submission
      }

      toast({
        title: "ส่งงานสำเร็จ",
        description: `ส่งใบ Coaching ${submissionType === "individual" ? "แบบส่วนตัว" : "แบบกลุ่ม"} สำเร็จแล้ว`,
      });

      setFile(null);
      setSessionNumber("");
      if (user?.id) fetchData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
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
                        {group.name} - {group.major} ชั้นปีที่ {group.year_level}
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
              เลือกประเภทการส่งงาน: ส่งแบบส่วนตัว หรือ ส่งแบบกลุ่ม
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>ประเภทการส่ง</Label>
              <Select value={submissionType} onValueChange={(value: "individual" | "group") => setSubmissionType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">ส่งแบบส่วนตัว</SelectItem>
                  <SelectItem value="group" disabled={!isLeader}>
                    ส่งแบบกลุ่ม {!isLeader && "(เฉพาะหัวหน้ากลุ่ม)"}
                  </SelectItem>
                </SelectContent>
              </Select>
              {submissionType === "group" && !isLeader && (
                <p className="text-sm text-yellow-600">
                  ⚠️ คุณต้องเป็นหัวหน้ากลุ่มจึงจะส่งแบบกลุ่มได้
                </p>
              )}
            </div>

            {submissionType === "group" && (
              <div className="space-y-2">
                <Label htmlFor="group">กลุ่มเรียน</Label>
                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                  <SelectTrigger id="group">
                    <SelectValue placeholder="เลือกกลุ่มเรียน" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name} - {group.year_level} ({group.major})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="teacher">
                  อาจารย์ที่ปรึกษา <span className="text-red-500">*</span>
                </Label>
                <Select 
                  value={selectedTeacher} 
                  onValueChange={setSelectedTeacher}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="เลือกอาจารย์" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {availableTeachers.length === 0 ? (
                      <div className="p-4 text-sm text-center text-muted-foreground">
                        ไม่พบชื่ออาจารย์
                      </div>
                    ) : (
                      availableTeachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.first_name} {teacher.last_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="sessionNumber">หมายเลขครั้งที่ <span className="text-red-500">*</span></Label>
                <Input
                  id="sessionNumber"
                  type="number"
                  value={sessionNumber}
                  onChange={(e) => setSessionNumber(e.target.value)}
                  placeholder="เช่น 1, 2, 3..."
                  min="1"
                  max={requiredSessions}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="file">อัปโหลดไฟล์ PDF <span className="text-red-500">*</span></Label>
                <Input 
                  id="file" 
                  type="file" 
                  accept=".pdf" 
                  onChange={(e) => e.target.files && setFile(e.target.files[0])}
                />
                {file && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ เลือกไฟล์: {file.name}
                  </p>
                )}
              </div>
            </div>
            <Button 
              onClick={handleSubmit} 
              disabled={isUploading || !file || !sessionNumber || !selectedTeacher || (submissionType === "group" && (!selectedGroup || !isLeader))}
              className="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              {isUploading ? "กำลังอัปโหลด..." : `ส่งใบ Coaching (${submissionType === "individual" ? "ส่วนตัว" : "กลุ่ม"})`}
            </Button>
          </CardContent>
        </Card>

        {submissionType === "group" && selectedGroup && isLeader && (
          <GroupMemberManager userId={user?.id || ""} groupId={selectedGroup} />
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">ประวัติการส่ง</CardTitle>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>ยังไม่มีประวัติการส่งใบ Coaching</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ครั้งที่</TableHead>
                      <TableHead>ประเภท</TableHead>
                      <TableHead>วันที่ส่ง</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead>คะแนน</TableHead>
                      <TableHead>ความคิดเห็น</TableHead>
                      <TableHead>ไฟล์</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>#{session.session_number}</TableCell>
                        <TableCell className="text-sm">
                          <Badge variant={session.group_id ? "default" : "outline"}>
                            {session.group_id ? "กลุ่ม" : "ส่วนตัว"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(session.created_at).toLocaleDateString("th-TH")}
                        </TableCell>
                        <TableCell>{getStatusBadge(session.status)}</TableCell>
                        <TableCell>
                          {session.score ? `${session.score}/${session.max_score || 100}` : "-"}
                        </TableCell>
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
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
