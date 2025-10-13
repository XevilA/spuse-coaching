import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Users, FileCheck, Clock } from "lucide-react";

interface TeacherDashboardProps {
  stats: {
    totalSessions: number;
    approvedSessions: number;
    pendingSessions: number;
    rejectedSessions: number;
    year67Students: number;
    year68Students: number;
    groupsManaged: number;
  };
  groups: any[];
  sessions: any[];
}

export function TeacherDashboard({ stats, groups, sessions }: TeacherDashboardProps) {
  const getGroupProgress = (groupId: string) => {
    const groupSessions = sessions.filter(s => s.group_id === groupId);
    const group = groups.find(g => g.id === groupId);
    const required = group?.required_sessions || 10;
    const completed = groupSessions.filter(s => s.status === "approved").length;
    return { completed, required, percentage: (completed / required) * 100 };
  };

  return (
    <div className="space-y-6">
      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">กลุ่มที่ดูแล</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold">{stats.groupsManaged}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Coaching ทั้งหมด</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold">{stats.totalSessions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">นักศึกษารหัส 67</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-blue-600">{stats.year67Students}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">นักศึกษารหัส 68</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-green-600">{stats.year68Students}</div>
          </CardContent>
        </Card>
      </div>

      {/* Status Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">สถานะการตรวจสอบ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 sm:p-4 bg-primary/10 rounded-lg">
              <span className="text-sm sm:text-base">อนุมัติแล้ว</span>
              <span className="text-xl sm:text-2xl font-bold text-primary">{stats.approvedSessions}</span>
            </div>
            <div className="flex items-center justify-between p-3 sm:p-4 bg-warning/10 rounded-lg">
              <span className="text-sm sm:text-base">รอตรวจสอบ</span>
              <span className="text-xl sm:text-2xl font-bold text-warning">{stats.pendingSessions}</span>
            </div>
            <div className="flex items-center justify-between p-3 sm:p-4 bg-destructive/10 rounded-lg">
              <span className="text-sm sm:text-base">ไม่อนุมัติ</span>
              <span className="text-xl sm:text-2xl font-bold text-destructive">{stats.rejectedSessions}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Group Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">ความคืบหน้าของกลุ่ม</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {groups.map((group) => {
              const progress = getGroupProgress(group.id);
              return (
                <div key={group.id} className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
                    <span className="font-medium text-sm sm:text-base">
                      {group.name} - {group.major} ปี {group.year_level}
                    </span>
                    <span className="text-xs sm:text-sm text-muted-foreground">
                      {progress.completed}/{progress.required} ใบ
                    </span>
                  </div>
                  <Progress value={progress.percentage} className="h-2" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
