import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutomationLog {
  id: string;
  event_type: string;
  notification_type: string;
  recipient_id: string;
  metadata: {
    group_name?: string;
    student_name?: string;
    session_number?: number;
    score?: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Processing automation notifications...');

    // Fetch pending automation logs
    const { data: logs, error: logsError } = await supabase
      .from('automation_logs')
      .select('*')
      .eq('status', 'pending')
      .limit(50);

    if (logsError) {
      throw logsError;
    }

    if (!logs || logs.length === 0) {
      console.log('No pending automation logs to process');
      return new Response(
        JSON.stringify({ message: 'No pending logs', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Found ${logs.length} pending logs to process`);
    let processed = 0;
    let failed = 0;

    for (const log of logs as AutomationLog[]) {
      try {
        // Get recipient details
        const { data: recipient } = await supabase
          .from('profiles')
          .select('email, first_name, last_name')
          .eq('id', log.recipient_id)
          .single();

        if (!recipient) {
          console.error(`Recipient not found: ${log.recipient_id}`);
          await supabase
            .from('automation_logs')
            .update({ status: 'failed', error_message: 'Recipient not found' })
            .eq('id', log.id);
          failed++;
          continue;
        }

        // Prepare notification message
        let message = '';
        if (log.event_type === 'coaching_submitted') {
          message = `🔔 แจ้งเตือน: มีใบ Coaching ใหม่\n\nกลุ่ม: ${log.metadata.group_name || 'ไม่มีกลุ่ม'}\nนักศึกษา: ${log.metadata.student_name}\nครั้งที่: ${log.metadata.session_number}\n\nกรุณาตรวจสอบและให้คะแนน`;
        } else if (log.event_type === 'coaching_reviewed') {
          message = `✅ ใบ Coaching ของคุณได้รับการตรวจแล้ว\n\nครั้งที่: ${log.metadata.session_number}\nคะแนน: ${log.metadata.score || 'ไม่ระบุ'}\n\nตรวจสอบรายละเอียดในระบบ`;
        }

        // Send notification based on type
        if (log.notification_type === 'line' || log.notification_type === 'both') {
          // Get LINE channel from notification preferences
          const { data: prefs } = await supabase
            .from('notification_preferences')
            .select('line_channel_id')
            .eq('user_id', log.recipient_id)
            .eq('event_type', log.event_type)
            .single();

          if (prefs?.line_channel_id) {
            // Send LINE notification
            const { error: lineError } = await supabase.functions.invoke('send-line-notification', {
              body: {
                message,
                channelId: prefs.line_channel_id,
              },
            });

            if (lineError) {
              console.error(`Failed to send LINE notification:`, lineError);
              throw lineError;
            }
          }
        }

        if (log.notification_type === 'email' || log.notification_type === 'both') {
          // For email, we would integrate with a service like Resend
          // For now, just log it
          console.log(`Would send email to: ${recipient.email}`);
          console.log(`Message: ${message}`);
        }

        // Mark as sent
        await supabase
          .from('automation_logs')
          .update({ status: 'sent' })
          .eq('id', log.id);

        processed++;
        console.log(`Successfully processed log ${log.id}`);
      } catch (error: any) {
        console.error(`Failed to process log ${log.id}:`, error);
        await supabase
          .from('automation_logs')
          .update({
            status: 'failed',
            error_message: error?.message || 'Unknown error',
          })
          .eq('id', log.id);
        failed++;
      }
    }

    console.log(`Processed: ${processed}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({
        message: 'Automation notifications processed',
        processed,
        failed,
        total: logs.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in process-automation-notifications:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
