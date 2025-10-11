import { useState, useEffect, useMemo } from "react";
import { Calendar, dateFnsLocalizer, Event } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { th } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import "react-big-calendar/lib/css/react-big-calendar.css";

const locales = { th };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface AppointmentEvent extends Event {
  id: string;
  title?: string;
  start?: Date;
  end?: Date;
  resource: any;
}

interface AppointmentCalendarProps {
  role: "teacher" | "admin" | "super_admin";
  userId: string;
}

export const AppointmentCalendar = ({ role, userId }: AppointmentCalendarProps) => {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<AppointmentEvent | null>(null);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    let query = supabase.from("appointments").select(`
      *,
      teacher:profiles!appointments_teacher_id_fkey(first_name, last_name),
      student:profiles!appointments_student_id_fkey(first_name, last_name)
    `);

    if (role === "teacher") {
      query = query.eq("teacher_id", userId);
    }

    const { data } = await query;
    if (data) setAppointments(data);
  };

  const events: AppointmentEvent[] = useMemo(() => {
    return appointments.map((apt) => {
      const date = new Date(apt.appointment_date);
      const [startHour, startMinute] = apt.start_time.split(":").map(Number);
      const [endHour, endMinute] = apt.end_time.split(":").map(Number);

      const start = new Date(date);
      start.setHours(startHour, startMinute);

      const end = new Date(date);
      end.setHours(endHour, endMinute);

      return {
        id: apt.id,
        title: apt.status === "available" 
          ? "ว่าง" 
          : `${apt.student?.first_name || ""} ${apt.student?.last_name || ""}`,
        start,
        end,
        resource: apt,
      };
    });
  }, [appointments]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available": return "bg-secondary";
      case "booked": return "bg-warning";
      case "completed": return "bg-success";
      case "cancelled": return "bg-destructive";
      default: return "bg-muted";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "available": return "ว่าง";
      case "booked": return "จองแล้ว";
      case "completed": return "เสร็จสิ้น";
      case "cancelled": return "ยกเลิก";
      default: return status;
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>ปฏิทินนัดหมาย Coaching</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[600px]">
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              culture="th"
              onSelectEvent={(event) => setSelectedEvent(event as AppointmentEvent)}
              eventPropGetter={(event: any) => ({
                style: {
                  backgroundColor: 
                    event.resource.status === "available" ? "#94a3b8" :
                    event.resource.status === "booked" ? "#f59e0b" :
                    event.resource.status === "completed" ? "#10b981" :
                    "#ef4444",
                },
              })}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>รายละเอียดนัดหมาย</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">วันที่</p>
                <p>{selectedEvent.start && format(selectedEvent.start, "dd MMMM yyyy", { locale: th })}</p>
              </div>
              <div>
                <p className="text-sm font-medium">เวลา</p>
                <p>{selectedEvent.start && selectedEvent.end && `${format(selectedEvent.start, "HH:mm")} - ${format(selectedEvent.end, "HH:mm")}`}</p>
              </div>
              <div>
                <p className="text-sm font-medium">สถานะ</p>
                <Badge className={getStatusColor(selectedEvent.resource.status)}>
                  {getStatusText(selectedEvent.resource.status)}
                </Badge>
              </div>
              {selectedEvent.resource.teacher && (
                <div>
                  <p className="text-sm font-medium">อาจารย์</p>
                  <p>{selectedEvent.resource.teacher.first_name} {selectedEvent.resource.teacher.last_name}</p>
                </div>
              )}
              {selectedEvent.resource.student && (
                <div>
                  <p className="text-sm font-medium">นักศึกษา</p>
                  <p>{selectedEvent.resource.student.first_name} {selectedEvent.resource.student.last_name}</p>
                </div>
              )}
              {selectedEvent.resource.notes && (
                <div>
                  <p className="text-sm font-medium">หมายเหตุ</p>
                  <p className="text-sm text-muted-foreground">{selectedEvent.resource.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
