import { Entity, CreateDateColumn, ManyToOne, JoinColumn, PrimaryColumn } from "typeorm";
import { Tenant } from "./Tenant";
import { License } from "./License";

@Entity("tenant_licenses")
export class TenantLicense {
    @PrimaryColumn({ name: "tenant_id", type: "uuid" })
    tenantId: string;

    @PrimaryColumn({ name: "license_code", type: "varchar", length: 50 })
    licenseCode: string;

    @ManyToOne(() => Tenant, (tenant) => tenant.tenantLicenses, { onDelete: "CASCADE" })
    @JoinColumn({ name: "tenant_id" })
    tenant: Tenant;

    @ManyToOne(() => License, { onDelete: "CASCADE" })
    @JoinColumn({ name: "license_code" })
    license: License;

    @CreateDateColumn({ name: "granted_at", type: "timestamp with time zone" })
    grantedAt: Date;
}
