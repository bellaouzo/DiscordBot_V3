import { describe, expect, it } from "vitest";
import { PermissionFlagsBits } from "discord.js";
import {
  HasConfiguredAdminRole,
  HasConfiguredModRole,
  IsAdmin,
  IsModerator,
  IsAppealReviewer,
} from "@utilities/StaffPermissions";

function CreateMember(options: {
  roleIds?: string[];
  permissions?: bigint[];
}): never {
  const permissionBits = options.permissions ?? [];
  return {
    roles: {
      cache: {
        some: (fn: (role: { id: string }) => boolean) =>
          (options.roleIds ?? []).some((id) => fn({ id })),
      },
    },
    permissions: {
      has: (flag: bigint) => permissionBits.includes(flag),
    },
  } as never;
}

describe("StaffPermissions", () => {
  const settings = {
    adminRoleIds: ["admin-role"],
    modRoleIds: ["mod-role"],
  };

  it("grants admin via configured admin role", () => {
    const member = CreateMember({ roleIds: ["admin-role"] });
    expect(IsAdmin(member, settings)).toBe(true);
    expect(IsModerator(member, settings)).toBe(true);
  });

  it("grants moderator via configured mod role", () => {
    const member = CreateMember({ roleIds: ["mod-role"] });
    expect(IsAdmin(member, settings)).toBe(false);
    expect(IsModerator(member, settings)).toBe(true);
    expect(IsAppealReviewer(member, settings)).toBe(true);
  });

  it("grants moderator via discord ban permission", () => {
    const member = CreateMember({
      permissions: [PermissionFlagsBits.BanMembers],
    });
    expect(IsModerator(member, settings)).toBe(true);
  });

  it("checks configured admin role only via HasConfiguredAdminRole", () => {
    const adminMember = CreateMember({ roleIds: ["admin-role"] });
    const modMember = CreateMember({ roleIds: ["mod-role"] });
    const permMember = CreateMember({
      permissions: [PermissionFlagsBits.BanMembers],
    });

    expect(HasConfiguredAdminRole(adminMember, settings)).toBe(true);
    expect(HasConfiguredAdminRole(modMember, settings)).toBe(false);
    expect(HasConfiguredAdminRole(permMember, settings)).toBe(false);
  });

  it("checks configured mod role only via HasConfiguredModRole", () => {
    const modMember = CreateMember({ roleIds: ["mod-role"] });
    const permMember = CreateMember({
      permissions: [PermissionFlagsBits.BanMembers],
    });

    expect(HasConfiguredModRole(modMember, settings)).toBe(true);
    expect(HasConfiguredModRole(permMember, settings)).toBe(false);
  });
});
