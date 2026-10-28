// 시험 도우미: 노무·장비 행에서 구조 단위 연결(sectionId)을 떼고 비교한다
export const strip = <T extends { sectionId?: string }>(rows: T[]): Omit<T, "sectionId">[] =>
  rows.map((row) => {
    const { sectionId: _drop, ...rest } = row;
    void _drop;
    return rest;
  });
