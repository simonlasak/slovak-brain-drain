"""
Pydantic models for Stage 2 output validation.

Each model defines one row in the corresponding parquet file.
The transform modules validate every row before writing.
"""
from __future__ import annotations

from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field


# ─── Shared enums ────────────────────────────────────────────────────────────

class GeoLevel(str, Enum):
    kraj = "kraj"
    okres = "okres"
    obec = "obec"


class Sex(str, Enum):
    M = "M"
    F = "F"
    all = "all"


class AgeBracket(str, Enum):
    age_0_14 = "0-14"
    age_15_19 = "15-19"
    age_20_24 = "20-24"
    age_25_29 = "25-29"
    age_30_34 = "30-34"
    age_35_39 = "35-39"
    age_40_44 = "40-44"
    age_45_49 = "45-49"
    age_50_54 = "50-54"
    age_55_59 = "55-59"
    age_60_64 = "60-64"
    age_65_plus = "65+"
    all = "all"


class Education(str, Enum):
    isced_0_2 = "isced_0-2"
    isced_3_4 = "isced_3-4"
    isced_5_8 = "isced_5-8"
    all = "all"


# ─── Section 1: Internal demographics ────────────────────────────────────────

class Section1Metric(str, Enum):
    population = "population"
    births = "births"
    births_live = "births_live"
    deaths = "deaths"
    # `internal_in`, `internal_out` and `internal_net` are DELIBERATELY ABSENT.
    # No SUSR cube we hold separates internal from international migration:
    # every indicator of all 13 held cubes was searched, and only om7011rr,
    # om7013rr and om7104rr carry migration at all, each with the same
    # undifferentiated family. internal_in/out were declared here and in
    # 04-spec.md and nothing ever produced them, because the source cannot.
    # internal_net did exist, fed by IN010076, which is natural increase.
    natural_increase = "natural_increase"
    # One migration family whose meaning depends on geo_level: international at
    # geo_level='nation' (verified against Eurostat migr_emi1ctz), moves across
    # the unit's own boundary (internal included) at every sub-national level.
    migr_in = "migr_in"
    migr_out = "migr_out"
    migr_net = "migr_net"
    total_change = "total_change"
    avg_wage_eur = "avg_wage_eur"
    unemployment_rate = "unemployment_rate"
    tertiary_outbound_rate = "tertiary_outbound_rate"
    secondary_completion_rate = "secondary_completion_rate"


class Section1Row(BaseModel):
    year: int = Field(ge=2004, le=2026)
    geo_level: GeoLevel
    geo_code: str
    geo_name: str
    age_bracket: AgeBracket
    sex: Sex
    education: Education
    metric: Section1Metric
    value: float
    is_interpolated: bool = False
    source: str


# ─── Section 2: SK↔CZ corridor ───────────────────────────────────────────────

class FlowDirection(str, Enum):
    sk_to_cz = "sk_to_cz"
    cz_to_sk = "cz_to_sk"


class Pathway(str, Enum):
    student = "student"
    labour = "labour"
    other = "other"
    all = "all"


class Section2Metric(str, Enum):
    stock = "stock"
    inflow = "inflow"
    students_enrolled = "students_enrolled"
    students_graduated = "students_graduated"
    stay_rate = "stay_rate"
    wage_eur = "wage_eur"


class Section2Row(BaseModel):
    year: int = Field(ge=2004, le=2026)
    flow_direction: FlowDirection
    pathway: Pathway
    sk_geo_code: str
    cz_geo_code: str
    age_bracket: AgeBracket
    sex: Sex
    education: Education
    field_or_sector: str
    metric: Section2Metric
    value: float
    is_interpolated: bool = False
    source: str


# ─── Section 3: Global diaspora ──────────────────────────────────────────────

class SlovakDef(str, Enum):
    born = "born"
    citizen = "citizen"
    identified = "identified"


class Section3Metric(str, Enum):
    stock = "stock"
    inflow = "inflow"
    emigration_rate = "emigration_rate"


class Section3Row(BaseModel):
    year: int = Field(ge=1990, le=2026)
    slovak_def: SlovakDef
    destination_iso3: str
    sex: Sex
    age_bracket: AgeBracket
    education: Education
    metric: Section3Metric
    value: float
    is_interpolated: bool = False
    source: str


# ─── Section 4: Notable people ────────────────────────────────────────────────

class SlovakEducation(str, Enum):
    none = "none"
    primary_only = "primary_only"
    secondary_only = "secondary_only"
    tertiary = "tertiary"


class NotablePerson(BaseModel):
    id: str
    name: str
    name_sk: str
    birth_year: int
    birth_place: str
    left_year: int
    age_at_leaving: int
    slovak_education_completed: SlovakEducation
    destination_path: list[str]
    current_location: str
    field: str
    trigger: str
    narrative: str
    impact: str
    sources: list[str]
    photo_url: Optional[str] = None
