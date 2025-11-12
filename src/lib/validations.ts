import { z } from "zod";

// Email validation with domain restrictions
export const emailSchema = z.string()
  .email("รูปแบบอีเมลไม่ถูกต้อง")
  .toLowerCase()
  .refine(
    (email) => !email.includes("..") && !email.includes(" "),
    "อีเมลมีอักขระที่ไม่ถูกต้อง"
  );

export const studentEmailSchema = emailSchema.refine(
  (email) => email.endsWith("@spumail.net"),
  "ต้องใช้อีเมล @spumail.net เท่านั้น"
);

export const teacherEmailSchema = emailSchema.refine(
  (email) => email.endsWith("@spu.ac.th"),
  "ต้องใช้อีเมล @spu.ac.th เท่านั้น"
);

export const universityEmailSchema = emailSchema.refine(
  (email) => email.endsWith("@spumail.net") || email.endsWith("@spu.ac.th"),
  "ต้องใช้อีเมล @spumail.net หรือ @spu.ac.th เท่านั้น"
);

// Student Group validation
export const groupNameSchema = z.string()
  .trim()
  .min(1, "กรุณากรอกชื่อกลุ่ม")
  .max(100, "ชื่อกลุ่มยาวเกินไป (สูงสุด 100 ตัวอักษร)")
  .refine(
    (name) => name.length > 0 && !name.match(/[<>{}]/),
    "ชื่อกลุ่มมีอักขระที่ไม่อนุญาต"
  );

export const majorSchema = z.string()
  .trim()
  .min(1, "กรุณาเลือกสาขาวิชา")
  .max(100, "ชื่อสาขายาวเกินไป (สูงสุด 100 ตัวอักษร)");

export const yearLevelSchema = z.string()
  .regex(/^[1-4]$/, "ชั้นปีต้องเป็น 1-4 เท่านั้น");

export const studentGroupSchema = z.object({
  name: groupNameSchema,
  major: majorSchema,
  year_level: yearLevelSchema,
  required_sessions: z.number().int().min(1).max(20).default(3)
});

// Authentication schemas
export const loginSchema = z.object({
  identifier: z.string()
    .trim()
    .min(1, "กรุณากรอกอีเมลหรือรหัสนักศึกษา/รหัสพนักงาน"),
  password: z.string().min(6, "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"),
});

export const registerSchema = z.object({
  email: studentEmailSchema,
  password: z.string()
    .min(6, "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร")
    .max(100, "รหัสผ่านยาวเกินไป"),
  confirmPassword: z.string(),
  firstName: z.string()
    .trim()
    .min(1, "กรุณากรอกชื่อ")
    .max(100, "ชื่อยาวเกินไป"),
  lastName: z.string()
    .trim()
    .min(1, "กรุณากรอกนามสกุล")
    .max(100, "นามสกุลยาวเกินไป"),
  studentId: z.string()
    .trim()
    .min(8, "รหัสนักศึกษาต้องมีอย่างน้อย 8 หลัก")
    .max(20, "รหัสนักศึกษายาวเกินไป")
    .optional(),
  groupId: z.string().uuid("กรุณาเลือกกลุ่มเรียน").optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "รหัสผ่านไม่ตรงกัน",
  path: ["confirmPassword"],
});

// LINE notification validation
export const lineMessageSchema = z.string()
  .trim()
  .min(1, "ข้อความต้องไม่ว่างเปล่า")
  .max(5000, "ข้อความยาวเกินไป (สูงสุด 5000 ตัวอักษร)")
  .refine(
    (msg) => !msg.match(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/),
    "ข้อความมีอักขระที่ไม่ถูกต้อง"
  )
  .refine(
    (msg) => (msg.match(/\n/g) || []).length < 100,
    "มีการขึ้นบรรทัดใหม่มากเกินไป"
  );

// Teacher comment validation
export const commentSchema = z.string()
  .trim()
  .max(1000, "ความคิดเห็นยาวเกินไป (สูงสุด 1000 ตัวอักษร)")
  .optional();

// Profile update validation
export const profileUpdateSchema = z.object({
  first_name: z.string().trim().min(1).max(100).optional(),
  last_name: z.string().trim().min(1).max(100).optional(),
  student_id: z.string().trim().min(8).max(20).optional(),
  employee_id: z.string().trim().min(5).max(20).optional(),
  year_level: yearLevelSchema.optional(),
  major: majorSchema.optional(),
});

// User creation validation (for admins)
export const createUserSchema = z.object({
  email: universityEmailSchema,
  password: z.string().min(6).max(100),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  role: z.enum(["student", "teacher", "admin", "super_admin", "external_evaluator"]),
  studentId: z.string().trim().min(8).max(20).optional(),
  employeeId: z.string().trim().min(5).max(20).optional(),
});