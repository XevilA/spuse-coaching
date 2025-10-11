import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { Calendar, Clock, Plus, X } from "lucide-react";

interface AppointmentManagerProps {
  role: "teacher" | "student";
  userId: string;
}

export const AppointmentManager = ({ role, userId }: AppointmentManagerProps) => {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    date: "",
    startTime: "",
    endTime: "",
    notes: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    if (role === "teacher") {
      const { data } = await supabase
        .from("appointments")
        .select(`
          *,
          student:profiles!appointments_student_id_fkey(first_name, last_name, student_id)
        `)
        .eq("teacher_id", userId)
        .order("appointment_date", { ascending: true });
      if (data) setAppointments(data);
    } else {
      const { data } = await supabase
        .from("appointments")
        .select(`
          *,
          teacher:profiles!appointments_teacher_id_fkey(first_name, last_name)
        `)
        .eq("status", "available")
        .order("appointment_date", { ascending: true });
      if (data) setAppointments(data);
    }
  };

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from("appointments").insert({
        teacher_id: userId,
        appointment_date: formData.date,
        start_time: formData.startTime,
        end_time: formData.endTime,
        status: "available",
        notes: formData.notes,
      });

      if (error) throw error;

      toast({
        title: "สำเร็จ",
        description: "เพิ่มช่วงเวลาว่างแล้ว",
      });

      setShowForm(false);
      setFormData({ date: "", startTime: "", endTime: "", notes: "" });
      fetchAppointments();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    }
  };

  const handleBookAppointment = async (appointmentId: string) => {
    try {
      const { data, error } = await supabase.rpc('book_appointment_atomic', {
        appointment_id: appointmentId,
        student_id: userId,
      });

      if (error) throw error;
      
      if (!data) {
        throw new Error("ไม่สามารถจองนัดหมายได้ อาจมีคนจองไปแล้วหรือนัดหมายไม่สามารถจองได้");
      }

      toast({
        title: "สำเร็จ",
        description: "จองนัดหมายแล้ว",
      });

      fetchAppointments();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({
          status: "cancelled",
        })
        .eq("id", appointmentId);

      if (error) throw error;

      toast({
        title: "สำเร็จ",
        description: "ยกเลิกนัดหมายแล้ว",
      });

      fetchAppointments();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "available":
        return <Badge variant="secondary">ว่าง</Badge>;
      case "booked":
        return <Badge className="bg-warning">จองแล้ว</Badge>;
      case "completed":
        return <Badge className="bg-success">เสร็จสิ้น</Badge>;
      case "cancelled":
        return <Badge variant="destructive">ยกเลิก</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>
          {role === "teacher" ? "จัดการเวลานัดหมาย" : "จองนัดหมาย Coaching"}
        </CardTitle>
        {role === "teacher" && (
          <Button onClick={() => setShowForm(!showForm)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            เพิ่มเวลาว่าง
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && role === "teacher" && (
          <form onSubmit={handleCreateSlot} className="space-y-4 p-4 border rounded-lg">
            <div>
              <label className="block text-sm font-medium mb-2">วันที่</label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">เวลาเริ่ม</label>
                <Input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">เวลาสิ้นสุด</label>
                <Input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">หมายเหตุ</label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="เช่น ห้อง, อาคาร"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit">บันทึก</Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                ยกเลิก
              </Button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {appointments.map((apt) => (
            <div key={apt.id} className="p-4 border rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(apt.appointment_date).toLocaleDateString("th-TH")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>{apt.start_time} - {apt.end_time}</span>
                  </div>
                  {getStatusBadge(apt.status)}
                </div>
              </div>

              {role === "teacher" && apt.student && (
                <p className="text-sm text-muted-foreground">
                  นักศึกษา: {apt.student.first_name} {apt.student.last_name} ({apt.student.student_id})
                </p>
              )}

              {role === "student" && apt.teacher && (
                <p className="text-sm text-muted-foreground">
                  อาจารย์: {apt.teacher.first_name} {apt.teacher.last_name}
                </p>
              )}

              {apt.notes && (
                <p className="text-sm text-muted-foreground">{apt.notes}</p>
              )}

              <div className="flex gap-2">
                {role === "student" && apt.status === "available" && (
                  <Button size="sm" onClick={() => handleBookAppointment(apt.id)}>
                    จองนัดหมาย
                  </Button>
                )}
                {role === "teacher" && apt.status === "booked" && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleCancelAppointment(apt.id)}
                  >
                    <X className="w-4 h-4 mr-2" />
                    ยกเลิกนัดหมาย
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
