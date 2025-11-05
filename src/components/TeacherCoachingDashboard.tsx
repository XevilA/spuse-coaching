import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Users, FileCheck, Clock, CheckCircle, XCircle, Eye, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Group {
  id: string;
  name: string;
  major: string;
  year_level: string;
  required_sessions: number;
}

interface Session {
  id: string;
  student_id: string;
  teacher_id: string | null;
  group_id: string | null;
  session_number: number;
  status: "pending" | "approved" | "rejected";
  score: number | null;
  max_score: number | null;
  teacher_comment: string | null;
  file_url: string;
  file_name: string;
  created_at: string;
  student?: {
    first_name: string;
    last_name: string;
    student_id: string;
    group_id: string | null;
  };
}

interface TeacherAssignment {
  id: string;
  teacher_id: string;
  group_id: string;
  student_groups?: Group;
}

interface TeacherCoachingDashboardProps {
  groups: Group[];
  sessions: Session[];
  teacherAssignments: TeacherAssignment[];
  teacherId: string;
  teacherProfile: any;
  onApprove: (sessionId: string, action: "approved" | "rejected", comment?: string, score?: number) => Promise<void>;
  onViewFile: (fileUrl: string) => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export function TeacherCoachingDashboard({ 
  groups, 
  sessions, 
  teacherAssignments,
  teacherId,
  teacherProfile,
  onApprove,
  onViewFile 
}: TeacherCoachingDashboardProps) {
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [comment, setComment] = useState("");
  const [score, setScore] = useState<number>(100);
  const { toast } = useToast();

  // Get years from groups
  const availableYears = useMemo(() => {
    const years = [...new Set(groups.map(g => g.year_level))].sort();
    return years;
  }, [groups]);

  // Filter groups by selected year
  const filteredGroups = useMemo(() => {
    if (selectedYear === "all") return groups;
    return groups.filter(g => g.year_level === selectedYear);
  }, [groups, selectedYear]);

  // Get groups assigned to teacher
  const assignedGroupIds = useMemo(() => {
    return teacherAssignments.map(ta => ta.group_id);
  }, [teacherAssignments]);

  // Filter sessions by year and group
  const filteredSessions = useMemo(() => {
    let filtered = sessions;

    if (selectedYear !== "all") {
      const yearGroupIds = filteredGroups.map(g => g.id);
      filtered = filtered.filter(s => 
        s.student?.group_id && yearGroupIds.includes(s.student.group_id)
      );
    }

    if (selectedGroup !== "all") {
      filtered = filtered.filter(s => s.student?.group_id === selectedGroup);
    }

    return filtered;
  }, [sessions, selectedYear, selectedGroup, filteredGroups]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = filteredSessions.length;
    const approved = filteredSessions.filter(s => s.status === "approved").length;
    const pending = filteredSessions.filter(s => s.status === "pending").length;
    const rejected = filteredSessions.filter(s => s.status === "rejected").length;

    return { total, approved, pending, rejected };
  }, [filteredSessions]);

  // Prepare chart data
  const chartData = useMemo(() => {
    const groupData = filteredGroups.map(group => {
      const groupSessions = filteredSessions.filter(s => s.student?.group_id === group.id);
      const approved = groupSessions.filter(s => s.status === "approved").length;
      const pending = groupSessions.filter(s => s.status === "pending").length;
      const rejected = groupSessions.filter(s => s.status === "rejected").length;

      return {
        name: group.name,
        อนุมัติ: approved,
        รอตรวจ: pending,
        ปฏิเสธ: rejected,
        total: groupSessions.length,
        required: group.required_sessions
      };
    });

    return groupData;
  }, [filteredGroups, filteredSessions]);

  // Pie chart data
  const pieData = [
    { name: 'อนุมัติแล้ว', value: stats.approved },
    { name: 'รอตรวจสอบ', value: stats.pending },
    { name: 'ไม่อนุมัติ', value: stats.rejected },
  ];

  const handleApproveClick = (session: Session) => {
    setCurrentSession(session);
    setComment(session.teacher_comment || "");
    setScore(session.score || 100);
    setApproveDialogOpen(true);
  };

  const handleApproveSubmit = async (action: "approved" | "rejected") => {
    if (!currentSession) return;

    try {
      await onApprove(currentSession.id, action, comment, action === "approved" ? score : undefined);
      setApproveDialogOpen(false);
      setCurrentSession(null);
      setComment("");
      setScore(100);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message
      });
    }
  };

  const getGroupInfo = (groupId: string | null) => {
    if (!groupId) return null;
    return groups.find(g => g.id === groupId);
  };

  const getTeacherForGroup = (groupId: string) => {
    const assignment = teacherAssignments.find(ta => ta.group_id === groupId);
    return assignment ? teacherProfile : null;
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Dashboard Coaching ตามปีการศึกษา
          </CardTitle>
          <CardDescription>เลือกปีการศึกษาและกลุ่มเพื่อดูข้อมูล</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>ปีการศึกษา</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกปี" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกปี</SelectItem>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year}>
                      ปี {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>กลุ่ม</Label>
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกกลุ่ม" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกกลุ่ม</SelectItem>
                  {filteredGroups.map(group => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name} - {group.major}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-blue-500" />
              Coaching ทั้งหมด
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              อนุมัติแล้ว
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-500" />
              รอตรวจสอบ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500" />
              ไม่อนุมัติ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>สถิติการส่งงานแต่ละกลุ่ม</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="อนุมัติ" fill="#22c55e" />
                <Bar dataKey="รอตรวจ" fill="#eab308" />
                <Bar dataKey="ปฏิเสธ" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>สัดส่วนสถานะ</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Groups Progress */}
      <Card>
        <CardHeader>
          <CardTitle>ความคืบหน้าแต่ละกลุ่ม</CardTitle>
          <CardDescription>แสดงผลตามกลุ่มและอาจารย์ที่ปรึกษา</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {filteredGroups.map(group => {
            const groupSessions = filteredSessions.filter(s => s.student?.group_id === group.id);
            const approved = groupSessions.filter(s => s.status === "approved").length;
            const progress = (approved / group.required_sessions) * 100;
            const teacher = getTeacherForGroup(group.id);
            const isAssigned = assignedGroupIds.includes(group.id);

            return (
              <div key={group.id} className="space-y-2 p-4 border rounded-lg">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {group.name} - {group.major} ปี {group.year_level}
                      </span>
                      {isAssigned && (
                        <Badge variant="default">กลุ่มของคุณ</Badge>
                      )}
                    </div>
                    {teacher && (
                      <p className="text-sm text-muted-foreground">
                        👨‍🏫 อาจารย์ที่ปรึกษา: {teacher.first_name} {teacher.last_name}
                      </p>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {approved}/{group.required_sessions} ใบ ({Math.round(progress)}%)
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Pending Sessions for Approval */}
      <Card>
        <CardHeader>
          <CardTitle>รายการรอตรวจสอบ</CardTitle>
          <CardDescription>คลิกเพื่ออนุมัติหรือไม่อนุมัติ</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredSessions
              .filter(s => s.status === "pending")
              .map(session => {
                const groupInfo = getGroupInfo(session.student?.group_id || null);
                return (
                  <div key={session.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {session.student?.first_name} {session.student?.last_name}
                        </span>
                        <Badge variant="secondary">ครั้งที่ {session.session_number}</Badge>
                      </div>
                      {groupInfo && (
                        <p className="text-sm text-muted-foreground">
                          กลุ่ม: {groupInfo.name} - {groupInfo.major} ปี {groupInfo.year_level}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        ส่งเมื่อ: {new Date(session.created_at).toLocaleString('th-TH')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewFile(session.file_url)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        ดูไฟล์
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApproveClick(session)}
                      >
                        ตรวจสอบ
                      </Button>
                    </div>
                  </div>
                );
              })}
            {filteredSessions.filter(s => s.status === "pending").length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                ไม่มีรายการรอตรวจสอบ
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ตรวจสอบใบ Coaching</DialogTitle>
            <DialogDescription>
              {currentSession && (
                <>
                  นักศึกษา: {currentSession.student?.first_name} {currentSession.student?.last_name} 
                  <br />
                  ครั้งที่: {currentSession.session_number}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>คะแนน (เต็ม {currentSession?.max_score || 100})</Label>
              <Input
                type="number"
                value={score.toString()}
                onChange={(e) => setScore(Number(e.target.value) || 0)}
                min={0}
                max={currentSession?.max_score || 100}
              />
            </div>
            <div className="space-y-2">
              <Label>ความคิดเห็น</Label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="ใส่ความคิดเห็น (ถ้ามี)"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button variant="destructive" onClick={() => handleApproveSubmit("rejected")}>
              <XCircle className="w-4 h-4 mr-1" />
              ไม่อนุมัติ
            </Button>
            <Button onClick={() => handleApproveSubmit("approved")}>
              <CheckCircle className="w-4 h-4 mr-1" />
              อนุมัติ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
