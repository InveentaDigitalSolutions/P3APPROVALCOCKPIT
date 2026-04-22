/**
 * Raw Dataverse row types — verified against live `pac org fetch` output
 * on 2026-04-22 against env PWRAPPS_DV_UC_OTD_3104_Dev.
 *
 * If a runtime query errors with "no column X", fix the name here only —
 * every other layer uses these typed fields.
 */

/** `crf4f_ilevels_1` — one row per (iLevel × week offset) */
export interface DvILevel {
    crf4f_ilevels_1id?: string;

    crf4f_ilevel?: string;           // "29-07-250"
    crf4f_number?: number;           // maturity level (reife), e.g. 250

    crf4f_ats?: string;
    crf4f_sab?: string;
    crf4f_fs?: string;
    crf4f_sf?: string;

    crf4f_offset?: string;           // "ATS" | "ATS+1" | ... | "SAB"
    crf4f_week?: string;             // "YYYY-WW"
    crf4f_kw?: number;
    crf4f_weekindex?: number;

    crf4f_planningcycle?: string;
    crf4f_startofproduction?: string;
    crf4f_status?: number;
    crf4f_swipreleases?: string;
    crf4f_oc?: string;
    crf4f_name?: number;             // Dataverse auto-display, numeric id
}

/** `crf4f_hvs` — Speichertyp × date × WBS join */
export interface DvHvs {
    crf4f_hvsid?: string;
    crf4f_key?: string;              // "P-114758-VS_I"
    crf4f_speichertyp?: string;      // "B6RO0 -001 | RR XL | HP-PH"
    crf4f_pnummer?: string;          // "P-114758"
    crf4f_wbs_type?: string;         // "VS_I"
    crf4f_musterorspeicher?: string; // "D1.0"
    crf4f_penthouse?: string;        // "D-HP"
    crf4f_bauphase?: string;         // "VS4.1 & VS2 (HEA)"
    crf4f_monatjahr?: string;        // "Aug-27"
    crf4f_sop?: string;              // "27-07"
    crf4f_wmmlink?: string;
    crf4f_wmmlink_1?: string;
    crf4f_name?: string;
}

/** `crf4f_ip3_freigaben` — HVS ⋈ CDH_IP3 (one row per Speicher × WBS × SOLL milestone) */
export interface DvIP3Freigaben {
    crf4f_ip3_freigabenid?: string;
    crf4f_key?: string;
    crf4f_speichertyp?: string;
    crf4f_pnummer?: string;
    crf4f_wbs_type?: string;
    crf4f_musterorspeicher?: string;
    crf4f_penthouse?: string;
    crf4f_bauphase?: string;
    crf4f_monatjahr?: string;
    crf4f_sop?: string;
    crf4f_sollfreigabe?: string;     // "L1" | "L2" | "L3" | "L4" | "RSTB"
    crf4f_startweek?: string;        // "YYYY-WW"
    crf4f_wmmlink?: string;
    crf4f_wmmlink_1?: string;
    crf4f_name?: string;
}

/** `crf4f_verbundfreigaben` — Swap tickets (Thursdays) */
export interface DvVerbundfreigabe {
    crf4f_verbundfreigabenid?: string;
    crf4f_key?: string;
    crf4f_ilevelname?: string;
    crf4f_name?: string;
    crf4f_startdate?: string;
    crf4f_enddate?: string;
    crf4f_collapseid?: string;
    crf4f_replaced?: boolean;
}

/** `crf4f_planned_component_approvals` — Penthouse tickets (Tuesdays) */
export interface DvPlannedComponentApproval {
    crf4f_planned_component_approvalsid?: string;
    crf4f__id?: string;              // external id (double-underscore in DV)
    crf4f_id?: string;
    crf4f_jirakey?: string;
    crf4f_jiraurl?: string;
    crf4f_name?: string;
    crf4f_duedate?: string;
    crf4f_duedatehistory?: string;
    crf4f_ilevelnames?: string;      // JSON array string
    crf4f_parentjiraissue?: string;
    crf4f_parentbranches?: string;   // JSON array string
    crf4f_parentecu?: string;
    crf4f_brvs?: string;             // JSON array string
    crf4f_sops?: string;             // JSON array string
    crf4f_hwplannings?: string;
    crf4f_relateditems?: string;
    crf4f_labels?: string;
    crf4f_markeddescriptionrows?: string;
    crf4f_color?: string;
    crf4f_updatedat?: string;
    crf4f_updated?: string;
    crf4f_deleted?: boolean;
    crf4f_kw?: number;
    crf4f_year?: number;
    crf4f_yearweek?: string;
}

/** `crf4f_wbs_type_mapping` — WBS_TYPE → MUSTER */
export interface DvWbsTypeMapping {
    crf4f_wbs_type_mappingid?: string;
    crf4f_wbs_type?: string;         // "VS_I"
    crf4f_muster?: string;           // "D1.0"
    crf4f_name?: string;
}

/** `crf4f_brv` — distinct BRV identifiers */
export interface DvBrv {
    crf4f_brvid?: string;
    crf4f_name?: string;             // "NA05"
}

/** `crf4f_cdh_ip3` — SOLL milestone definitions */
export interface DvCdhIp3 {
    crf4f_cdh_ip3id?: string;
    crf4f_key?: string;
    crf4f_name?: string;
    crf4f_name_3?: string;
    crf4f_sollfreigabe?: string;
    crf4f_wbs_type3clean?: string;
    crf4f_startweek?: string;
    crf4f_start_date?: string;
    crf4f_end_date?: string;
    crf4f_displ_start_date?: string;
    crf4f_displ_end_date?: string;
    crf4f_description?: string;
    crf4f_task_type?: string;
    crf4f_in_sync_with?: string;
    crf4f_elektr_reichweite?: string;
    crf4f_elektr_reichweiten?: string;
}
