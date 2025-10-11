import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";

interface RoomBookingFormProps {
  userId: string;
  onSuccess?: () => void;
}

export const RoomBookingForm = ({ userId, onSuccess }: RoomBookingFormProps) => {
  const [formData, setFormData] = useState({
    room_name: "Student Lounge",
    booking_date: "",
    start_time: "",
    end_time: "",
    purpose: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.from("room_bookings").insert({
        student_id: userId,
        ...formData,
      });

      if (error) throw error;

      toast({
        title: "สำเร็จ",
        description: "ส่งคำขอจองห้องแล้ว",
      });

      setFormData({
        room_name: "Student Lounge",
        booking_date: "",
        start_time: "",
        end_time: "",
        purpose: "",
      });

      onSuccess?.();
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>จองห้อง Student Lounge</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>ชื่อห้อง</Label>
            <Input
              value={formData.room_name}
              onChange={(e) => setFormData({ ...formData, room_name: e.target.value })}
              placeholder="Student Lounge"
              required
            />
          </div>

          <div>
            <Label>วันที่จอง</Label>
            <Input
              type="date"
              value={formData.booking_date}
              onChange={(e) => setFormData({ ...formData, booking_date: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>เวลาเริ่ม</Label>
              <Input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>เวลาสิ้นสุด</Label>
              <Input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <Label>วัตถุประสงค์</Label>
            <Textarea
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              placeholder="กรุณาระบุวัตถุประสงค์การใช้ห้อง"
              required
            />
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            ส่งคำขอจอง
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
