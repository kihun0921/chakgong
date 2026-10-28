// 시험용 기준 데이터: 실제 기준 공정표(중대범죄수사청(본청·서울청) 사무환경 조성사업(기계) 예정공정표·인원장비투입계획표)에서
// 추출한 값이다. 공정별 일정·인일·대·일은 산정근거의 값이고, expected는 정답표의 구간 값이다.
// 개발자 승인 없이 수정하지 않는다. (SRS 13.1 T-05·T-07·T-10·T-11)

import type { LaborMethod } from "../labor";

export type GoldenProcess = { key: string; name: string; amount: number; startDay: number; endDay: number };
export type GoldenLine = { processKey: string; name: string; manDays: number; method: LaborMethod };

export const DAAI = {
  "project": "중대범죄수사청(본청·서울청) 사무환경 조성사업(기계)   /   수요기관 : 행정안전부 중대범죄수사청개청준비단   /   공사기간 : 착공일부터 70일",
  "start": "2026-11-02",
  "durationDays": 70,
  "completion": "2027-01-10",
  "holidays": [
    "2026-12-25",
    "2027-01-01"
  ],
  "summaryTotalWon": 622764021,
  "processes": [
    {
      "key": "GA1",
      "name": "1.가설사무소·창고 설치및해체",
      "amount": 2241356,
      "startDay": 1,
      "endDay": 70
    },
    {
      "key": "GA2",
      "name": "2.안전관리비 작성용역",
      "amount": 3000000,
      "startDay": 1,
      "endDay": 14
    },
    {
      "key": "DEM",
      "name": "Ⅱ. 철거공사",
      "amount": 1088409,
      "startDay": 8,
      "endDay": 14
    },
    {
      "key": "EQ",
      "name": "Ⅲ. 장비설치공사",
      "amount": 7967206,
      "startDay": 36,
      "endDay": 42
    },
    {
      "key": "DUCT",
      "name": "Ⅳ. 공조덕트설치공사",
      "amount": 7172963,
      "startDay": 15,
      "endDay": 26
    },
    {
      "key": "WSUP",
      "name": "1.급수급탕배관공사",
      "amount": 45818211,
      "startDay": 15,
      "endDay": 49
    },
    {
      "key": "WDRN",
      "name": "2.오배수배관공사",
      "amount": 43334872,
      "startDay": 15,
      "endDay": 42
    },
    {
      "key": "WFIX",
      "name": "3.위생기구설치공사",
      "amount": 5853467,
      "startDay": 43,
      "endDay": 56
    },
    {
      "key": "HP1",
      "name": "1.냉난방기 물품·판넬 반입",
      "amount": 27308400,
      "startDay": 8,
      "endDay": 28
    },
    {
      "key": "HP2",
      "name": "2.실외기 양중·설치(옥상)",
      "amount": 15717191,
      "startDay": 15,
      "endDay": 21
    },
    {
      "key": "HP3",
      "name": "3.실내기·점검구 설치",
      "amount": 15573966,
      "startDay": 29,
      "endDay": 56
    },
    {
      "key": "HP4",
      "name": "4.냉매배관공사",
      "amount": 130885111,
      "startDay": 18,
      "endDay": 56
    },
    {
      "key": "HP5",
      "name": "5.드레인배관공사",
      "amount": 24869767,
      "startDay": 22,
      "endDay": 49
    },
    {
      "key": "HP6",
      "name": "6.제어기 및 제어선 설치공사",
      "amount": 44822799,
      "startDay": 36,
      "endDay": 63
    },
    {
      "key": "HP7",
      "name": "7.배관커버 및 트레이 설치공사",
      "amount": 15323856,
      "startDay": 29,
      "endDay": 56
    },
    {
      "key": "FL0",
      "name": "1.설계검토 및 도면작업",
      "amount": 5000000,
      "startDay": 1,
      "endDay": 14
    },
    {
      "key": "FL1",
      "name": "2.FTU 이설·신설(2~5층)",
      "amount": 66223500,
      "startDay": 15,
      "endDay": 35
    },
    {
      "key": "FL2",
      "name": "3.FTU 이설·신설(6~9층)",
      "amount": 34482000,
      "startDay": 22,
      "endDay": 42
    },
    {
      "key": "FL3",
      "name": "4.FTU 이설·신설(10~13층)",
      "amount": 16390500,
      "startDay": 29,
      "endDay": 49
    },
    {
      "key": "FL4",
      "name": "5.FTU 이설(14~17층)",
      "amount": 12222000,
      "startDay": 36,
      "endDay": 56
    },
    {
      "key": "FL5",
      "name": "6.BMS 및 잡자재(공용)",
      "amount": 60165000,
      "startDay": 43,
      "endDay": 63
    },
    {
      "key": "HEAT",
      "name": "Ⅷ. 바닥난방설치공사",
      "amount": 3437734,
      "startDay": 49,
      "endDay": 56
    },
    {
      "key": "TAB",
      "name": "Ⅸ. 기계설비 T.A.B공사",
      "amount": 33865713,
      "startDay": 45,
      "endDay": 68
    },
    {
      "key": "GOV",
      "name": "1.관급(분리발주) 공정 협조",
      "amount": 0,
      "startDay": 22,
      "endDay": 56
    },
    {
      "key": "COM",
      "name": "2.시운전·준공검사 및 정리",
      "amount": 0,
      "startDay": 64,
      "endDay": 70
    }
  ],
  "laborLines": [
    {
      "processKey": "EQ",
      "name": "보통인부",
      "manDays": 1,
      "method": "내역서"
    },
    {
      "processKey": "EQ",
      "name": "보일러공",
      "manDays": 1,
      "method": "내역서"
    },
    {
      "processKey": "EQ",
      "name": "기계설비공",
      "manDays": 1,
      "method": "내역서"
    },
    {
      "processKey": "DUCT",
      "name": "덕트공",
      "manDays": 6,
      "method": "내역서"
    },
    {
      "processKey": "WFIX",
      "name": "보통인부",
      "manDays": 2,
      "method": "내역서"
    },
    {
      "processKey": "WFIX",
      "name": "위생공",
      "manDays": 11,
      "method": "내역서"
    },
    {
      "processKey": "WSUP",
      "name": "보통인부",
      "manDays": 14,
      "method": "내역서"
    },
    {
      "processKey": "WSUP",
      "name": "배관공",
      "manDays": 44,
      "method": "내역서"
    },
    {
      "processKey": "WDRN",
      "name": "보통인부",
      "manDays": 17,
      "method": "내역서"
    },
    {
      "processKey": "WDRN",
      "name": "배관공",
      "manDays": 53,
      "method": "내역서"
    },
    {
      "processKey": "DEM",
      "name": "보통인부",
      "manDays": 2,
      "method": "내역서"
    },
    {
      "processKey": "DEM",
      "name": "배관공",
      "manDays": 4,
      "method": "내역서"
    },
    {
      "processKey": "HEAT",
      "name": "내선전공",
      "manDays": 1,
      "method": "내역서"
    },
    {
      "processKey": "HEAT",
      "name": "내장공",
      "manDays": 3,
      "method": "내역서"
    },
    {
      "processKey": "HEAT",
      "name": "보통인부",
      "manDays": 2,
      "method": "내역서"
    },
    {
      "processKey": "HP2",
      "name": "기계설비공",
      "manDays": 27,
      "method": "환산"
    },
    {
      "processKey": "HP2",
      "name": "보통인부",
      "manDays": 25,
      "method": "환산"
    },
    {
      "processKey": "HP3",
      "name": "기계설비공",
      "manDays": 43,
      "method": "환산"
    },
    {
      "processKey": "HP3",
      "name": "보통인부",
      "manDays": 40,
      "method": "환산"
    },
    {
      "processKey": "HP4",
      "name": "배관공",
      "manDays": 231,
      "method": "환산"
    },
    {
      "processKey": "HP4",
      "name": "보통인부",
      "manDays": 179,
      "method": "환산"
    },
    {
      "processKey": "HP5",
      "name": "배관공",
      "manDays": 68,
      "method": "환산"
    },
    {
      "processKey": "HP5",
      "name": "보통인부",
      "manDays": 53,
      "method": "환산"
    },
    {
      "processKey": "HP6",
      "name": "내선전공",
      "manDays": 120,
      "method": "환산"
    },
    {
      "processKey": "HP6",
      "name": "보통인부",
      "manDays": 82,
      "method": "환산"
    },
    {
      "processKey": "HP7",
      "name": "덕트공",
      "manDays": 20,
      "method": "환산"
    },
    {
      "processKey": "HP7",
      "name": "보통인부",
      "manDays": 16,
      "method": "환산"
    },
    {
      "processKey": "FL1",
      "name": "기계설비공",
      "manDays": 25,
      "method": "생산성"
    },
    {
      "processKey": "FL1",
      "name": "내선전공",
      "manDays": 12,
      "method": "생산성"
    },
    {
      "processKey": "FL1",
      "name": "보통인부",
      "manDays": 12,
      "method": "생산성"
    },
    {
      "processKey": "FL2",
      "name": "기계설비공",
      "manDays": 22,
      "method": "생산성"
    },
    {
      "processKey": "FL2",
      "name": "내선전공",
      "manDays": 11,
      "method": "생산성"
    },
    {
      "processKey": "FL2",
      "name": "보통인부",
      "manDays": 11,
      "method": "생산성"
    },
    {
      "processKey": "FL3",
      "name": "기계설비공",
      "manDays": 20,
      "method": "생산성"
    },
    {
      "processKey": "FL3",
      "name": "내선전공",
      "manDays": 10,
      "method": "생산성"
    },
    {
      "processKey": "FL3",
      "name": "보통인부",
      "manDays": 10,
      "method": "생산성"
    },
    {
      "processKey": "FL4",
      "name": "기계설비공",
      "manDays": 17,
      "method": "생산성"
    },
    {
      "processKey": "FL4",
      "name": "내선전공",
      "manDays": 8,
      "method": "생산성"
    },
    {
      "processKey": "FL4",
      "name": "보통인부",
      "manDays": 8,
      "method": "생산성"
    },
    {
      "processKey": "FL5",
      "name": "내선전공",
      "manDays": 30,
      "method": "가정"
    },
    {
      "processKey": "FL5",
      "name": "보통인부",
      "manDays": 8,
      "method": "가정"
    },
    {
      "processKey": "TAB",
      "name": "TAB기술자",
      "manDays": 48,
      "method": "가정"
    },
    {
      "processKey": "COM",
      "name": "기계설비공",
      "manDays": 10,
      "method": "가정"
    },
    {
      "processKey": "COM",
      "name": "보통인부",
      "manDays": 10,
      "method": "가정"
    }
  ],
  "equipmentLines": [
    {
      "processKey": "HP2",
      "name": "타이어크레인 100T",
      "manDays": 3,
      "method": "가정"
    },
    {
      "processKey": "HP2",
      "name": "카고트럭 5T",
      "manDays": 3,
      "method": "가정"
    },
    {
      "processKey": "DEM",
      "name": "카고트럭 5T",
      "manDays": 5,
      "method": "가정"
    },
    {
      "processKey": "DUCT",
      "name": "고소작업대(시저리프트)",
      "manDays": 10,
      "method": "가정"
    },
    {
      "processKey": "WSUP",
      "name": "고소작업대(시저리프트)",
      "manDays": 25,
      "method": "가정"
    },
    {
      "processKey": "WDRN",
      "name": "고소작업대(시저리프트)",
      "manDays": 20,
      "method": "가정"
    },
    {
      "processKey": "HP3",
      "name": "고소작업대(시저리프트)",
      "manDays": 38,
      "method": "가정"
    },
    {
      "processKey": "HP4",
      "name": "고소작업대(시저리프트)",
      "manDays": 52,
      "method": "가정"
    },
    {
      "processKey": "HP5",
      "name": "고소작업대(시저리프트)",
      "manDays": 20,
      "method": "가정"
    },
    {
      "processKey": "HP6",
      "name": "고소작업대(시저리프트)",
      "manDays": 18,
      "method": "가정"
    },
    {
      "processKey": "HP7",
      "name": "고소작업대(시저리프트)",
      "manDays": 19,
      "method": "가정"
    },
    {
      "processKey": "HP4",
      "name": "코어드릴링머신",
      "manDays": 10,
      "method": "가정"
    },
    {
      "processKey": "HP5",
      "name": "코어드릴링머신",
      "manDays": 4,
      "method": "가정"
    },
    {
      "processKey": "WDRN",
      "name": "코어드릴링머신",
      "manDays": 5,
      "method": "가정"
    },
    {
      "processKey": "WSUP",
      "name": "코어드릴링머신",
      "manDays": 1,
      "method": "가정"
    },
    {
      "processKey": "HP4",
      "name": "동관 브레이징 장비",
      "manDays": 30,
      "method": "가정"
    },
    {
      "processKey": "WSUP",
      "name": "STS 압착(프레스)공구",
      "manDays": 25,
      "method": "가정"
    },
    {
      "processKey": "HP4",
      "name": "진공펌프·질소가압시험기",
      "manDays": 8,
      "method": "가정"
    }
  ],
  "keys": [
    {
      "key": "GA1",
      "name": "1.가설사무소·창고 설치및해체",
      "start": "2026-11-02",
      "end": "2027-01-10",
      "workdays": 48
    },
    {
      "key": "GA2",
      "name": "2.안전관리비 작성용역",
      "start": "2026-11-02",
      "end": "2026-11-15",
      "workdays": 10
    },
    {
      "key": "DEM",
      "name": "Ⅱ. 철거공사",
      "start": "2026-11-09",
      "end": "2026-11-15",
      "workdays": 5
    },
    {
      "key": "EQ",
      "name": "Ⅲ. 장비설치공사",
      "start": "2026-12-07",
      "end": "2026-12-13",
      "workdays": 5
    },
    {
      "key": "DUCT",
      "name": "Ⅳ. 공조덕트설치공사",
      "start": "2026-11-16",
      "end": "2026-11-27",
      "workdays": 10
    },
    {
      "key": "WSUP",
      "name": "1.급수급탕배관공사",
      "start": "2026-11-16",
      "end": "2026-12-20",
      "workdays": 25
    },
    {
      "key": "WDRN",
      "name": "2.오배수배관공사",
      "start": "2026-11-16",
      "end": "2026-12-13",
      "workdays": 20
    },
    {
      "key": "WFIX",
      "name": "3.위생기구설치공사",
      "start": "2026-12-14",
      "end": "2026-12-27",
      "workdays": 9
    },
    {
      "key": "HP1",
      "name": "1.냉난방기 물품·판넬 반입",
      "start": "2026-11-09",
      "end": "2026-11-29",
      "workdays": 15
    },
    {
      "key": "HP2",
      "name": "2.실외기 양중·설치(옥상)",
      "start": "2026-11-16",
      "end": "2026-11-22",
      "workdays": 5
    },
    {
      "key": "HP3",
      "name": "3.실내기·점검구 설치",
      "start": "2026-11-30",
      "end": "2026-12-27",
      "workdays": 19
    },
    {
      "key": "HP4",
      "name": "4.냉매배관공사",
      "start": "2026-11-19",
      "end": "2026-12-27",
      "workdays": 26
    },
    {
      "key": "HP5",
      "name": "5.드레인배관공사",
      "start": "2026-11-23",
      "end": "2026-12-20",
      "workdays": 20
    },
    {
      "key": "HP6",
      "name": "6.제어기 및 제어선 설치공사",
      "start": "2026-12-07",
      "end": "2027-01-03",
      "workdays": 18
    },
    {
      "key": "HP7",
      "name": "7.배관커버 및 트레이 설치공사",
      "start": "2026-11-30",
      "end": "2026-12-27",
      "workdays": 19
    },
    {
      "key": "FL0",
      "name": "1.설계검토 및 도면작업",
      "start": "2026-11-02",
      "end": "2026-11-15",
      "workdays": 10
    },
    {
      "key": "FL1",
      "name": "2.FTU 이설·신설(2~5층)",
      "start": "2026-11-16",
      "end": "2026-12-06",
      "workdays": 15
    },
    {
      "key": "FL2",
      "name": "3.FTU 이설·신설(6~9층)",
      "start": "2026-11-23",
      "end": "2026-12-13",
      "workdays": 15
    },
    {
      "key": "FL3",
      "name": "4.FTU 이설·신설(10~13층)",
      "start": "2026-11-30",
      "end": "2026-12-20",
      "workdays": 15
    },
    {
      "key": "FL4",
      "name": "5.FTU 이설(14~17층)",
      "start": "2026-12-07",
      "end": "2026-12-27",
      "workdays": 14
    },
    {
      "key": "FL5",
      "name": "6.BMS 및 잡자재(공용)",
      "start": "2026-12-14",
      "end": "2027-01-03",
      "workdays": 13
    },
    {
      "key": "HEAT",
      "name": "Ⅷ. 바닥난방설치공사",
      "start": "2026-12-20",
      "end": "2026-12-27",
      "workdays": 4
    },
    {
      "key": "TAB",
      "name": "Ⅸ. 기계설비 T.A.B공사",
      "start": "2026-12-16",
      "end": "2027-01-08",
      "workdays": 16
    },
    {
      "key": "GOV",
      "name": "1.관급(분리발주) 공정 협조",
      "start": "2026-11-23",
      "end": "2026-12-27",
      "workdays": 24
    },
    {
      "key": "COM",
      "name": "2.시운전·준공검사 및 정리",
      "start": "2027-01-04",
      "end": "2027-01-10",
      "workdays": 5
    }
  ],
  "laborDetail": [
    {
      "key": "EQ",
      "trade": "보통인부",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 1,
      "method": "내역서"
    },
    {
      "key": "EQ",
      "trade": "보일러공",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 1,
      "method": "내역서"
    },
    {
      "key": "EQ",
      "trade": "기계설비공",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 1,
      "method": "내역서"
    },
    {
      "key": "DUCT",
      "trade": "덕트공",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 6,
      "method": "내역서"
    },
    {
      "key": "WFIX",
      "trade": "보통인부",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 2,
      "method": "내역서"
    },
    {
      "key": "WFIX",
      "trade": "위생공",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 11,
      "method": "내역서"
    },
    {
      "key": "WSUP",
      "trade": "보통인부",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 14,
      "method": "내역서"
    },
    {
      "key": "WSUP",
      "trade": "배관공",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 44,
      "method": "내역서"
    },
    {
      "key": "WDRN",
      "trade": "보통인부",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 17,
      "method": "내역서"
    },
    {
      "key": "WDRN",
      "trade": "배관공",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 53,
      "method": "내역서"
    },
    {
      "key": "DEM",
      "trade": "보통인부",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 2,
      "method": "내역서"
    },
    {
      "key": "DEM",
      "trade": "배관공",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 4,
      "method": "내역서"
    },
    {
      "key": "HEAT",
      "trade": "내선전공",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 1,
      "method": "내역서"
    },
    {
      "key": "HEAT",
      "trade": "내장공",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 3,
      "method": "내역서"
    },
    {
      "key": "HEAT",
      "trade": "보통인부",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 2,
      "method": "내역서"
    },
    {
      "key": "HP2",
      "trade": "기계설비공",
      "ratio": 0.6,
      "laborCost": 8464250,
      "wage": 191108,
      "manDays": 27,
      "method": "환산"
    },
    {
      "key": "HP2",
      "trade": "보통인부",
      "ratio": 0.4,
      "laborCost": 8464250,
      "wage": 136016,
      "manDays": 25,
      "method": "환산"
    },
    {
      "key": "HP3",
      "trade": "기계설비공",
      "ratio": 0.6,
      "laborCost": 13549542,
      "wage": 191108,
      "manDays": 43,
      "method": "환산"
    },
    {
      "key": "HP3",
      "trade": "보통인부",
      "ratio": 0.4,
      "laborCost": 13549542,
      "wage": 136016,
      "manDays": 40,
      "method": "환산"
    },
    {
      "key": "HP4",
      "trade": "배관공",
      "ratio": 0.65,
      "laborCost": 69719790,
      "wage": 196169,
      "manDays": 231,
      "method": "환산"
    },
    {
      "key": "HP4",
      "trade": "보통인부",
      "ratio": 0.35,
      "laborCost": 69719790,
      "wage": 136016,
      "manDays": 179,
      "method": "환산"
    },
    {
      "key": "HP5",
      "trade": "배관공",
      "ratio": 0.65,
      "laborCost": 20585412,
      "wage": 196169,
      "manDays": 68,
      "method": "환산"
    },
    {
      "key": "HP5",
      "trade": "보통인부",
      "ratio": 0.35,
      "laborCost": 20585412,
      "wage": 136016,
      "manDays": 53,
      "method": "환산"
    },
    {
      "key": "HP6",
      "trade": "내선전공",
      "ratio": 0.7,
      "laborCost": 37048810,
      "wage": 215547,
      "manDays": 120,
      "method": "환산"
    },
    {
      "key": "HP6",
      "trade": "보통인부",
      "ratio": 0.3,
      "laborCost": 37048810,
      "wage": 136016,
      "manDays": 82,
      "method": "환산"
    },
    {
      "key": "HP7",
      "trade": "덕트공",
      "ratio": 0.6,
      "laborCost": 5469882,
      "wage": 163931,
      "manDays": 20,
      "method": "환산"
    },
    {
      "key": "HP7",
      "trade": "보통인부",
      "ratio": 0.4,
      "laborCost": 5469882,
      "wage": 136016,
      "manDays": 16,
      "method": "환산"
    },
    {
      "key": "FL1",
      "trade": "기계설비공",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 25,
      "method": "생산성"
    },
    {
      "key": "FL1",
      "trade": "내선전공",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 12,
      "method": "생산성"
    },
    {
      "key": "FL1",
      "trade": "보통인부",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 12,
      "method": "생산성"
    },
    {
      "key": "FL2",
      "trade": "기계설비공",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 22,
      "method": "생산성"
    },
    {
      "key": "FL2",
      "trade": "내선전공",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 11,
      "method": "생산성"
    },
    {
      "key": "FL2",
      "trade": "보통인부",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 11,
      "method": "생산성"
    },
    {
      "key": "FL3",
      "trade": "기계설비공",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 20,
      "method": "생산성"
    },
    {
      "key": "FL3",
      "trade": "내선전공",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 10,
      "method": "생산성"
    },
    {
      "key": "FL3",
      "trade": "보통인부",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 10,
      "method": "생산성"
    },
    {
      "key": "FL4",
      "trade": "기계설비공",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 17,
      "method": "생산성"
    },
    {
      "key": "FL4",
      "trade": "내선전공",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 8,
      "method": "생산성"
    },
    {
      "key": "FL4",
      "trade": "보통인부",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 8,
      "method": "생산성"
    },
    {
      "key": "FL5",
      "trade": "내선전공",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 30,
      "method": "가정"
    },
    {
      "key": "FL5",
      "trade": "보통인부",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 8,
      "method": "가정"
    },
    {
      "key": "TAB",
      "trade": "TAB기술자",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 48,
      "method": "가정"
    },
    {
      "key": "COM",
      "trade": "기계설비공",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 10,
      "method": "가정"
    },
    {
      "key": "COM",
      "trade": "보통인부",
      "ratio": null,
      "laborCost": null,
      "wage": null,
      "manDays": 10,
      "method": "가정"
    }
  ],
  "equipDetail": [
    {
      "key": "HP2",
      "name": "타이어크레인 100T",
      "units": 1,
      "days": 3,
      "unitDays": 3
    },
    {
      "key": "HP2",
      "name": "카고트럭 5T",
      "units": 1,
      "days": 3,
      "unitDays": 3
    },
    {
      "key": "DEM",
      "name": "카고트럭 5T",
      "units": 1,
      "days": 5,
      "unitDays": 5
    },
    {
      "key": "DUCT",
      "name": "고소작업대(시저리프트)",
      "units": 1,
      "days": 10,
      "unitDays": 10
    },
    {
      "key": "WSUP",
      "name": "고소작업대(시저리프트)",
      "units": 1,
      "days": 25,
      "unitDays": 25
    },
    {
      "key": "WDRN",
      "name": "고소작업대(시저리프트)",
      "units": 1,
      "days": 20,
      "unitDays": 20
    },
    {
      "key": "HP3",
      "name": "고소작업대(시저리프트)",
      "units": 2,
      "days": 19,
      "unitDays": 38
    },
    {
      "key": "HP4",
      "name": "고소작업대(시저리프트)",
      "units": 2,
      "days": 26,
      "unitDays": 52
    },
    {
      "key": "HP5",
      "name": "고소작업대(시저리프트)",
      "units": 1,
      "days": 20,
      "unitDays": 20
    },
    {
      "key": "HP6",
      "name": "고소작업대(시저리프트)",
      "units": 1,
      "days": 18,
      "unitDays": 18
    },
    {
      "key": "HP7",
      "name": "고소작업대(시저리프트)",
      "units": 1,
      "days": 19,
      "unitDays": 19
    },
    {
      "key": "HP4",
      "name": "코어드릴링머신",
      "units": 1,
      "days": 10,
      "unitDays": 10
    },
    {
      "key": "HP5",
      "name": "코어드릴링머신",
      "units": 1,
      "days": 4,
      "unitDays": 4
    },
    {
      "key": "WDRN",
      "name": "코어드릴링머신",
      "units": 1,
      "days": 5,
      "unitDays": 5
    },
    {
      "key": "WSUP",
      "name": "코어드릴링머신",
      "units": 1,
      "days": 1,
      "unitDays": 1
    },
    {
      "key": "HP4",
      "name": "동관 브레이징 장비",
      "units": 2,
      "days": 15,
      "unitDays": 30
    },
    {
      "key": "WSUP",
      "name": "STS 압착(프레스)공구",
      "units": 1,
      "days": 25,
      "unitDays": 25
    },
    {
      "key": "HP4",
      "name": "진공펌프·질소가압시험기",
      "units": 1,
      "days": 8,
      "unitDays": 8
    }
  ],
  "expected": {
    "periodProgress": [
      2.99,
      31.17,
      33.18,
      28.64,
      4.02
    ],
    "cumulative": [
      2.99,
      34.17,
      67.34,
      95.98,
      100
    ],
    "labor": {
      "보통인부": [
        2,
        128,
        206,
        146,
        10
      ],
      "배관공": [
        4,
        139,
        180,
        77,
        0
      ],
      "기계설비공": [
        0,
        57,
        70,
        28,
        10
      ],
      "내선전공": [
        0,
        14,
        73,
        105,
        0
      ],
      "덕트공": [
        0,
        7,
        12,
        7,
        0
      ],
      "위생공": [
        0,
        0,
        2,
        9,
        0
      ],
      "보일러공": [
        0,
        0,
        1,
        0,
        0
      ],
      "내장공": [
        0,
        0,
        0,
        3,
        0
      ],
      "TAB기술자": [
        0,
        0,
        0,
        33,
        15
      ]
    },
    "equipment": {
      "타이어크레인 100T": [
        0,
        3,
        0,
        0,
        0
      ],
      "고소작업대(시저리프트)": [
        0,
        57,
        93,
        52,
        0
      ],
      "카고트럭 5T": [
        5,
        3,
        0,
        0,
        0
      ],
      "코어드릴링머신": [
        0,
        7,
        9,
        4,
        0
      ],
      "동관 브레이징 장비": [
        0,
        9,
        13,
        8,
        0
      ],
      "STS 압착(프레스)공구": [
        0,
        11,
        11,
        3,
        0
      ],
      "진공펌프·질소가압시험기": [
        0,
        2,
        4,
        2,
        0
      ]
    },
    "laborTotal": 1338,
    "equipmentTotal": 296,
    "laborPeriodTotals": [
      6,
      345,
      544,
      408,
      35
    ],
    "equipmentPeriodTotals": [
      5,
      92,
      130,
      69,
      0
    ],
    "dailyAverage": [
      0.6,
      31.36,
      49.45,
      37.09,
      7
    ]
  }
} as const;
