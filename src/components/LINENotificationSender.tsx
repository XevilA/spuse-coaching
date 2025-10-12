import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import { Skeleton } from "./ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Send, MessageCircle, AlertCircle, CheckCircle, Loader2, Info } from "lucide-react";

interface LINENotificationSenderProps {
  userId: string;
  role: "teacher" | "admin" | "super_admin";
}

interface LINEChannel {
  id: string;
  name: string;
  description?: string;
  notification_type?: string;
}

export const LINENotificationSender = ({ userId, role }: LINENotificationSenderProps) => {
  const [channels, setChannels] = useState<LINEChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingChannels, setIsFetchingChannels] = useState(true);
  const { toast } = useToast();

  const MAX_MESSAGE_LENGTH = 5000;
  const messageLength = message.length;
  const isMessageTooLong = messageLength > MAX_MESSAGE_LENGTH;

  useEffect(() => {
    fetchChannels();
  }, [userId, role]);

  const fetchChannels = async () => {
    setIsFetchingChannels(true);
    try {
      if (role === "super_admin" || role === "admin") {
        // Super admin and admin can see all enabled channels
        const { data, error } = await supabase
          .from("line_notifications")
          .select("id, name, description, notification_type, enabled")
          .eq("enabled", true)
          .order("name");

        if (error) {
          console.error("Error fetching channels for admin:", error);
          throw error;
        }

        console.log("Admin channels fetched:", data);
        setChannels(data || []);
      } else {
        // Teachers can only see their assigned channels
        const { data, error } = await supabase
          .from("line_channel_assignments")
          .select(
            `
            line_notification_id,
            line_notifications!inner (
              id,
              name,
              description,
              notification_type,
              enabled
            )
          `,
          )
          .eq("teacher_id", userId);

        if (error) {
          console.error("Error fetching channels for teacher:", error);
          throw error;
        }

        console.log("Teacher channel assignments:", data);

        // Map and filter channels properly
        const teacherChannels =
          data
            ?.filter((item: any) => item.line_notifications?.enabled === true)
            .map((item: any) => ({
              id: item.line_notifications.id,
              name: item.line_notifications.name || "Unknown Channel",
              description: item.line_notifications.description,
              notification_type: item.line_notifications.notification_type,
            }))
            .filter((channel) => channel.id) || [];

        console.log("Mapped teacher channels:", teacherChannels);
        setChannels(teacherChannels);
      }
    } catch (error: any) {
      console.error("Error in fetchChannels:", error);
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: `ไม่สามารถโหลด LINE Channel ได้: ${error.message}`,
      });
    } finally {
      setIsFetchingChannels(false);
    }
  };

  const handleSend = async () => {
    // Validation
    if (!selectedChannel) {
      toast({
        variant: "destructive",
        title: "กรุณาเลือก Channel",
        description: "กรุณาเลือก Channel ที่ต้องการส่งข้อความ",
      });
      return;
    }

    if (!message.trim()) {
      toast({
        variant: "destructive",
        title: "กรุณากรอกข้อความ",
        description: "กรุณาพิมพ์ข้อความที่ต้องการส่ง",
      });
      return;
    }

    if (isMessageTooLong) {
      toast({
        variant: "destructive",
        title: "ข้อความยาวเกินไป",
        description: `ข้อความต้องไม่เกิน ${MAX_MESSAGE_LENGTH.toLocaleString()} ตัวอักษร`,
      });
      return;
    }

    setIsLoading(true);

    console.log("Sending message to channel:", selectedChannel);
    console.log("Message:", message.trim());

    try {
      const { data, error } = await supabase.functions.invoke("send-line-notification", {
        body: {
          message: message.trim(),
          channelId: selectedChannel,
        },
      });

      console.log("Edge function response:", { data, error });

      if (error) {
        console.error("Edge function error:", error);
        throw new Error(error.message || "Failed to send message");
      }

      // Check if the edge function returned an error in the response
      if (data?.error) {
        console.error("Edge function returned error:", data.error);
        throw new Error(data.error);
      }

      toast({
        title: "ส่งข้อความสำเร็จ",
        description: "ส่งข้อความไปยัง LINE เรียบร้อยแล้ว",
        duration: 5000,
      });

      // Reset form
      setMessage("");
      setSelectedChannel("");
    } catch (error: any) {
      console.error("Error sending message:", error);

      let errorMessage = "ไม่สามารถส่งข้อความได้";

      if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }

      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: errorMessage,
        duration: 7000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedChannelData = channels.find((c) => c.id === selectedChannel);

  // Loading State
  if (isFetchingChannels) {
    return (
      <Card className="shadow-lg border-0 animate-in fade-in duration-300">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className="shadow-lg border-0 hover:shadow-xl transition-all duration-300 animate-in fade-in duration-500">
        <CardHeader className="bg-gradient-to-r from-green-50 to-white border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-gray-900">ส่งข้อความไปยัง LINE</CardTitle>
              <CardDescription className="text-gray-600">ส่งการแจ้งเตือนผ่าน LINE Messaging API</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 p-6">
          {/* Empty State */}
          {channels.length === 0 ? (
            <Alert className="border-orange-200 bg-orange-50 animate-in slide-in-from-top duration-300">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              <AlertDescription className="text-orange-900">
                <p className="font-semibold mb-2">ไม่มี LINE Channel ที่พร้อมใช้งาน</p>
                <p className="text-sm">
                  {role === "teacher"
                    ? "กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์เข้าถึง LINE Channel"
                    : "กรุณาเพิ่ม LINE Channel ในส่วนการตั้งค่าก่อนใช้งาน"}
                </p>
                <p className="text-xs text-gray-600 mt-2">
                  User ID: {userId} | Role: {role}
                </p>
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Channel Selection */}
              <div className="space-y-2 animate-in slide-in-from-left duration-300">
                <div className="flex items-center justify-between">
                  <Label htmlFor="channel" className="text-base font-semibold">
                    เลือก LINE Channel <span className="text-red-500">*</span>
                  </Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs text-sm">
                        เลือก Channel ที่ต้องการส่งข้อความ
                        <br />
                        ข้อความจะถูกส่งไปยังผู้ที่ติดตาม Channel นั้น
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>

                <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                  <SelectTrigger
                    id="channel"
                    className="h-12 border-gray-200 hover:border-green-400 focus:border-green-500 focus:ring-green-500 transition-colors"
                  >
                    <SelectValue placeholder="เลือก Channel สำหรับส่งข้อความ" />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id} className="cursor-pointer">
                        <div className="flex items-center gap-2 py-1">
                          <MessageCircle className="w-4 h-4 text-green-600" />
                          <div>
                            <p className="font-medium">{channel.name}</p>
                            {channel.description && <p className="text-xs text-gray-500">{channel.description}</p>}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Selected Channel Info */}
                {selectedChannelData && (
                  <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <p className="text-sm font-medium text-green-900">
                        ข้อความจะถูกส่งผ่าน: {selectedChannelData.name}
                      </p>
                    </div>
                    {selectedChannelData.notification_type && (
                      <Badge variant="outline" className="mt-2 text-xs border-green-300 text-green-700">
                        {selectedChannelData.notification_type === "group" ? "Group Message" : "Broadcast Message"}
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {/* Message Input */}
              <div className="space-y-2 animate-in slide-in-from-right duration-300 delay-100">
                <div className="flex items-center justify-between">
                  <Label htmlFor="message" className="text-base font-semibold">
                    ข้อความ <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium ${
                        isMessageTooLong
                          ? "text-red-600"
                          : messageLength > MAX_MESSAGE_LENGTH * 0.8
                            ? "text-orange-600"
                            : "text-gray-500"
                      }`}
                    >
                      {messageLength} / {MAX_MESSAGE_LENGTH.toLocaleString()}
                    </span>
                  </div>
                </div>

                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="พิมพ์ข้อความที่ต้องการส่งไปยัง LINE...

ตัวอย่าง:
แจ้งเตือน: มีการเปลี่ยนแปลงตารางสอบ
กรุณาตรวจสอบข้อมูลในระบบ"
                  rows={8}
                  className={`resize-none border-2 focus:ring-2 transition-all ${
                    isMessageTooLong
                      ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                      : "border-gray-200 focus:border-green-500 focus:ring-green-200"
                  }`}
                  disabled={isLoading}
                />

                {/* Message Guidelines */}
                <Alert className="border-blue-200 bg-blue-50">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-sm text-blue-900">
                    <p className="font-medium mb-1">คำแนะนำ:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>ข้อความควรชัดเจนและกระชับ</li>
                      <li>ระบุวันที่และเวลาถ้าจำเป็น</li>
                      <li>ข้อความสูงสุด {MAX_MESSAGE_LENGTH.toLocaleString()} ตัวอักษร</li>
                    </ul>
                  </AlertDescription>
                </Alert>

                {/* Error Alert */}
                {isMessageTooLong && (
                  <Alert variant="destructive" className="animate-in slide-in-from-bottom duration-200">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      ข้อความยาวเกินไป กรุณาลดข้อความลงเหลือไม่เกิน {MAX_MESSAGE_LENGTH.toLocaleString()} ตัวอักษร
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Send Button */}
              <div className="pt-2 animate-in slide-in-from-bottom duration-300 delay-200">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Button
                        onClick={handleSend}
                        disabled={isLoading || !selectedChannel || !message.trim() || isMessageTooLong}
                        className="w-full h-12 text-base font-semibold bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            กำลังส่งข้อความ...
                          </>
                        ) : (
                          <>
                            <Send className="w-5 h-5 mr-2" />
                            ส่งข้อความไปยัง LINE
                          </>
                        )}
                      </Button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {!selectedChannel
                      ? "กรุณาเลือก Channel ก่อน"
                      : !message.trim()
                        ? "กรุณาพิมพ์ข้อความ"
                        : isMessageTooLong
                          ? "ข้อความยาวเกินไป"
                          : "คลิกเพื่อส่งข้อความ"}
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100 animate-in fade-in duration-500 delay-300">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">{channels.length}</p>
                  <p className="text-xs text-gray-600 mt-1">Channels</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">{messageLength}</p>
                  <p className="text-xs text-gray-600 mt-1">ตัวอักษร</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">
                    {message.split("\n").filter((line) => line.trim()).length}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">บรรทัด</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};
