import { z } from 'zod'

export const studentSchema = z.object({
    full_name: z.string().min(2, 'Name required'),
    phone: z.string().min(10, 'Valid phone required'),
    email: z.string().email().optional().or(z.literal('')),
    guardian_name: z.string().optional().or(z.literal('')),
    guardian_phone: z.string().optional().or(z.literal('')),
    guardian_relationship: z.string().optional().or(z.literal('')),
    city: z.string().optional(),
    enrollment_date: z.string().optional(),
    course_id: z.string().uuid().optional().or(z.literal('')),
    sub_course_id: z.string().uuid().optional().or(z.literal('')),
    department_id: z.string().uuid().optional().or(z.literal('')),
    sub_section_id: z.string().uuid().optional().or(z.literal('')),
    session_id: z.string().uuid().optional().or(z.literal('')),
    assigned_counsellor: z.string().uuid().optional().or(z.literal('')),
    status: z.enum(['active', 'completed', 'dropped', 'on_hold']),
    drop_reason: z.string().optional().or(z.literal('')),
    mode: z.enum(['attending', 'non-attending', 'regular', 'online']).optional().or(z.literal('')),
    total_fee: z.number().min(0).optional(),
    amount_paid: z.number().min(0).optional(),
    incentive_amount: z.number().min(0).optional(),
})

export type StudentFormData = z.infer<typeof studentSchema>
