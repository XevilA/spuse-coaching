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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        if (user?.id) fetchData(user.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "student_groups" }, () => {
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
      const [profileRes, sessionsRes, settingsRes, groupsRes, leaderRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("coaching_sessions").select("*").eq("student_id", userId).order("created_at", { ascending: false }),
        supabase.from("coaching_settings").select("*").eq("key", "min_sessions").single(),
        supabase.from("student_groups").select("*").order("name"),
        supabase.from("group_members").select("is_leader").eq("student_id", userId).single(),
      ]);

      if (profileRes.data) {
        setProfile(profileRes.data);
        setSelectedGroup(profileRes.data.group_id || "");
      }
      if (sessionsRes.data) setSessions(sessionsRes.data);
      if (settingsRes.data) setRequiredSessions(parseInt(settingsRes.data.value));
      if (groupsRes.data) setGroups(groupsRes.data);
      if (leaderRes.data) setIsLeader(leaderRes.data.is_leader || false);
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

      // Reset teacher selection when group changes
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

  // ฟังก์ชันดึงชื่ออาจารย์จากชื่อกลุ่ม
  const extractTeacherName = (groupName: string): string | null => {
    // Pattern: "กลุ่มเรียนที่ X (อาจารย์ชื่อ)" หรือ "กลุ่ม X (อาจารย์ชื่อ)"
    const match = groupName.match(/\(อาจารย์(.+?)\)/);
    if (match && match[1]) {
      return match[1].trim();
    }
    return null;
  };

  // ฟังก์ชันสร้างรายการอาจารย์จากกลุ่มที่เลือก
  const getAvailableTeachers = () => {
    if (!selectedGroup) return [];
    
    const selectedGroupData = groups.find(g => g.id === selectedGroup);
    if (!selectedGroupData) return [];

    const teacherName = extractTeacherName(selectedGroupData.name);
    if (!teacherName) return [];

    return [{
      id: teacherName, // ใช้ชื่อเป็น ID
      name: teacherName,
      fullName: `อาจารย์${teacherName}`
    }];
  };

  const availableTeachers = getAvailableTeachers();

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

      // เก็บชื่ออาจารย์เป็น text ใน teacher_comment หรือสร้าง field ใหม่
      const { error: insertError } = await supabase.from("coaching_sessions").insert({
        student_id: user.id,
        teacher_id: null, // ไม่มี teacher_id จริง
        group_id: selectedGroup || null,
        session_number: parseInt(sessionNumber),
        file_url: uploadData.path,
        file_name: file.name,
        status: "pending",
        teacher_comment: `อาจารย์${selectedTeacher}`, // เก็บชื่ออาจารย์ไว้ที่นี่
      });

      if (insertError) throw insertError;

      toast({
        title: "อัปโหลดสำเร็จ",
        description: `ส่งใบ Coaching ถึงอาจารย์${selectedTeacher} แล้ว (รอการยืนยัน)`,
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

        {!isLeader && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-4">
              <p className="text-sm text-yellow-800">
                ⚠️ เฉพาะหัวหน้ากลุ่มเท่านั้นที่สามารถส่งใบ Coaching ได้
              </p>
            </CardContent>
          </Card>
        )}

        {isLeader && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">อัปโหลดใบ Coaching</CardTitle>
              <CardDescription>
                คุณเป็นหัวหน้ากลุ่ม - เลือกอาจารย์ที่ปรึกษาและอัปโหลดใบ Coaching
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="teacher">
                  อาจารย์ที่ปรึกษา <span className="text-red-500">*</span>
                </Label>
                <Select 
                  value={selectedTeacher} 
                  onValueChange={setSelectedTeacher}
                  disabled={!selectedGroup}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder={selectedGroup ? "เลือกอาจารย์" : "เลือกกลุ่มเรียนก่อน"} />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {availableTeachers.length === 0 ? (
                      <div className="p-4 text-sm text-center text-muted-foreground">
                        {selectedGroup 
                          ? "ไม่พบชื่ออาจารย์ในกลุ่มนี้" 
                          : "กรุณาเลือกกลุ่มเรียนก่อน"}
                      </div>
                    ) : (
                      availableTeachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.fullName}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {selectedGroup && availableTeachers.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ✓ อาจารย์ประจำกลุ่ม: {groups.find((g) => g.id === selectedGroup)?.name}
                  </p>
                )}
                {selectedGroup && availableTeachers.length === 0 && (
                  <p className="text-xs text-yellow-600 mt-1">
                    ⚠️ ชื่อกลุ่มไม่มีข้อมูลอาจารย์ กรุณาติดต่อ Admin
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
              onClick={handleUploadSession} 
              disabled={isUploading || !selectedGroup || availableTeachers.length === 0} 
              className="w-full sm:w-auto"
            >
              <Upload className="w-4 h-4 mr-2" />
              {isUploading ? "กำลังอัปโหลด..." : "อัปโหลด"}
            </Button>
             {!selectedGroup && (
               <p className="text-sm text-yellow-600">
                 💡 เลือกกลุ่มเรียนก่อนเพื่ออัปโหลดใบ Coaching
               </p>
             )}
           </CardContent>
         </Card>
        )}

        {selectedGroup && isLeader && (
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
                      <TableHead>วันที่ส่ง</TableHead>
                      <TableHead>อาจารย์</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead>ความคิดเห็น</TableHead>
                      <TableHead>ไฟล์</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>#{session.session_number}</TableCell>
                        <TableCell className="text-sm">
                          {new Date(session.created_at).toLocaleDateString("th-TH")}
                        </TableCell>
                        <TableCell className="text-sm">
                          {session.teacher_comment?.includes("อาจารย์") 
                            ? session.teacher_comment.split("\n")[0] 
                            : "-"}
                        </TableCell>
                        <TableCell>{getStatusBadge(session.status)}</TableCell>
                        <TableCell className="max-w-xs truncate text-sm">
                          {session.teacher_comment?.split("\n").slice(1).join(" ") || "-"}
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
