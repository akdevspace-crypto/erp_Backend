import { z } from 'zod';

const booleanish = z.preprocess((value) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
  }
  return value;
}, z.boolean());

export const staffSchema = z.object({
  empId: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() || undefined : value),
    z.string().min(2, "Employee ID must be at least 2 characters").optional()
  ),
  photoUrl: z.string().optional(),
  firstName: z.string().min(2, "First Name is required"),
  lastName: z.string().optional(),
  designation: z.string().optional(),
  department: z.string().optional(),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().email("Valid email is required").optional().or(z.literal('')),
  joiningDate: z.string().datetime().optional().or(z.string().optional()),
  unitId: z.string().min(1, "Unit ID is required"),
  status: z.string().optional(),
  metadata: z.any().optional(),
  createLogin: booleanish.optional(),
  loginEmail: z.string().email("Valid login email is required").optional().or(z.literal('')),
  loginPassword: z.string().min(6, "Login password must be at least 6 characters").optional().or(z.literal('')),
  loginRoleId: z.string().optional(),
  roleId: z.string().optional()
}).superRefine((data, ctx) => {
  if (!data.createLogin) return;

  if (!data.loginEmail) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Login email is required when login creation is enabled',
      path: ['loginEmail']
    });
  }

  if (!data.loginPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Login password is required when login creation is enabled',
      path: ['loginPassword']
    });
  }

  if (!data.loginRoleId && !data.roleId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Role is required when login creation is enabled',
      path: ['roleId']
    });
  }
});

export const jobApplicationSchema = z.object({
  applicationNo: z.string().min(1),
  companyUnit: z.string().min(1),
  applyFor: z.string().min(1),
  experience: z.string().optional(),
  location: z.string().optional(),
  applicantName: z.string().min(1),
  mobileNo: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  resumeUrl: z.string().optional(),
  followupStatus: z.string().optional(),
  interestStatus: z.string().optional()
});

export const staffPrivilegeSchema = z.object({
  roleId: z.string().min(1, "Role ID is required"),
  loginEnabled: booleanish,
  forceLogout: booleanish.optional(),
  email: z.any().optional(),
  password: z.any().optional()
});

export const createStaffLoginSchema = z.object({
  email: z.string().email("Valid login email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  roleId: z.string().min(1, "Role ID is required")
});

export const staffMenuPrivilegeSchema = z.object({
  unitAccessMode: z.enum(['all', 'individual']).default('individual'),
  selectedUnitIds: z.array(z.string()).optional().default([]),
  permissions: z.record(
    z.string(),
    z.object({
      view: booleanish.optional().default(false),
      createUpdate: booleanish.optional().default(false)
    })
  ).optional().default({})
});
