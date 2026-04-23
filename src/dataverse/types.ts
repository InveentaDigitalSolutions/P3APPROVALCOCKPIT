/**
 * Raw Dataverse row types — verified against live `pac org fetch` output
 * on 2026-04-22 against env PWRAPPS_DV_UC_OTD_3104_Dev.
 *
 * If a runtime query errors with "no column X", fix the name here only —
 * every other layer uses these typed fields.
 */

/** `cr9b2_ilevels_1` — one row per (iLevel × week offset) */
export interface DvILevel {
    cr9b2_ilevels_1id?: string;

    cr9b2_ilevel?: string;           // "29-07-250"
    cr9b2_number?: number;           // maturity level (reife), e.g. 250

    cr9b2_ats?: string;
    cr9b2_sab?: string;
    cr9b2_fs?: string;
    cr9b2_sf?: string;

    cr9b2_offset?: string;           // "ATS" | "ATS+1" | ... | "SAB"
    cr9b2_week?: string;             // "YYYY-WW"
    cr9b2_kw?: number;
    cr9b2_weekindex?: number;

    cr9b2_planningcycle?: string;
    cr9b2_startofproduction?: string;
    cr9b2_status?: number;
    cr9b2_swipreleases?: string;
    cr9b2_oc?: string;
    cr9b2_name?: number;             // Dataverse auto-display, numeric id
}

/** `cr9b2_hvs` — Speichertyp × date × WBS join */
export interface DvHvs {
    cr9b2_hvsid?: string;
    cr9b2_key?: string;              // "P-114758-VS_I"
    cr9b2_speichertyp?: string;      // "B6RO0 -001 | RR XL | HP-PH"
    cr9b2_pnummer?: string;          // "P-114758"
    cr9b2_wbs_type?: string;         // "VS_I"
    cr9b2_musterorspeicher?: string; // "D1.0"
    cr9b2_penthouse?: string;        // "D-HP"
    cr9b2_bauphase?: string;         // "VS4.1 & VS2 (HEA)"
    cr9b2_monatjahr?: string;        // "Aug-27"
    cr9b2_sop?: string;              // "27-07"
    cr9b2_wmmlink?: string;
    cr9b2_wmmlink_1?: string;
    cr9b2_name?: string;
}

/** `cr9b2_ip3_freigaben` — HVS ⋈ CDH_IP3 (one row per Speicher × WBS × SOLL milestone) */
export interface DvIP3Freigaben {
    cr9b2_ip3_freigabenid?: string;
    cr9b2_key?: string;
    cr9b2_speichertyp?: string;
    cr9b2_pnummer?: string;
    cr9b2_wbs_type?: string;
    cr9b2_musterorspeicher?: string;
    cr9b2_penthouse?: string;
    cr9b2_bauphase?: string;
    cr9b2_monatjahr?: string;
    cr9b2_sop?: string;
    cr9b2_sollfreigabe?: string;     // "L1" | "L2" | "L3" | "L4" | "RSTB"
    cr9b2_startweek?: string;        // "YYYY-WW"
    cr9b2_wmmlink?: string;
    cr9b2_wmmlink_1?: string;
    cr9b2_name?: string;
}

/** `cr9b2_verbundfreigaben` — Swap tickets (Thursdays) */
export interface DvVerbundfreigabe {
    cr9b2_verbundfreigabenid?: string;
    cr9b2_key?: string;
    cr9b2_ilevelname?: string;
    cr9b2_name?: string;
    cr9b2_startdate?: string;
    cr9b2_enddate?: string;
    cr9b2_collapseid?: string;
    cr9b2_replaced?: boolean;
}

/** `cr9b2_planned_component_approvals` — Penthouse tickets (Tuesdays) */
export interface DvPlannedComponentApproval {
    cr9b2_planned_component_approvalsid?: string;
    cr9b2__id?: string;              // external id (double-underscore in DV)
    cr9b2_id?: string;
    cr9b2_jirakey?: string;
    cr9b2_jiraurl?: string;
    cr9b2_name?: string;
    cr9b2_duedate?: string;
    cr9b2_duedatehistory?: string;
    cr9b2_ilevelnames?: string;      // JSON array string
    cr9b2_parentjiraissue?: string;
    cr9b2_parentbranches?: string;   // JSON array string
    cr9b2_parentecu?: string;
    cr9b2_brvs?: string;             // JSON array string
    cr9b2_sops?: string;             // JSON array string
    cr9b2_hwplannings?: string;
    cr9b2_relateditems?: string;
    cr9b2_labels?: string;
    cr9b2_markeddescriptionrows?: string;
    cr9b2_color?: string;
    cr9b2_updatedat?: string;
    cr9b2_updated?: string;
    cr9b2_deleted?: boolean;
    cr9b2_kw?: number;
    cr9b2_year?: number;
    cr9b2_yearweek?: string;
}

/** `cr9b2_wbs_type_mapping` — WBS_TYPE → MUSTER */
export interface DvWbsTypeMapping {
    cr9b2_wbs_type_mappingid?: string;
    cr9b2_wbs_type?: string;         // "VS_I"
    cr9b2_muster?: string;           // "D1.0"
    cr9b2_name?: string;
}

/** `cr9b2_brv` — distinct BRV identifiers */
export interface DvBrv {
    cr9b2_brvid?: string;
    cr9b2_name?: string;             // "NA05"
}

/** `cr9b2_cdh_ip3` — SOLL milestone definitions */
export interface DvCdhIp3 {
    cr9b2_cdh_ip3id?: string;
    cr9b2_key?: string;
    cr9b2_name?: string;
    cr9b2_name_3?: string;
    cr9b2_sollfreigabe?: string;
    cr9b2_wbs_type3clean?: string;
    cr9b2_startweek?: string;
    cr9b2_start_date?: string;
    cr9b2_end_date?: string;
    cr9b2_displ_start_date?: string;
    cr9b2_displ_end_date?: string;
    cr9b2_description?: string;
    cr9b2_task_type?: string;
    cr9b2_in_sync_with?: string;
    cr9b2_elektr_reichweite?: string;
    cr9b2_elektr_reichweiten?: string;
}
