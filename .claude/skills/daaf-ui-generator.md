# DAAF UI Framework Generator Skill

## 사용법
이 스킬은 회사 DAAF 프레임워크 기반 UI JSON을 생성합니다.
화면 이미지나 설명을 제공하면 해당 프레임워크 형식의 JSON을 생성해 드립니다.

---

## 화면 생성 전 필수 질문 체크리스트

화면을 만들기 전에 아래 정보가 누락되면 반드시 사용자에게 질문할 것:

### 1. 화면 기본 정보
- [ ] 화면 이름/제목은?
- [ ] 어떤 업무 화면인가? (주문관리, 상품관리, 회원관리 등)

### 2. 검색 영역
- [ ] 검색 조건은 무엇인가? (날짜, 코드, 이름 등)
- [ ] 각 검색 필드의 타입은? (input, select, date, checkbox 등)
- [ ] 검색 버튼 외 다른 버튼이 필요한가?

### 3. 그리드/목록 영역
- [ ] 그리드 컬럼 정보는? (필드명, 헤더명, 너비)
- [ ] 행 선택 방식은? (single, multiple)
- [ ] 페이징 필요 여부 및 페이지 크기

### 4. 버튼/액션
- [ ] 어떤 버튼들이 필요한가? (신규, 저장, 삭제, 엑셀 등)
- [ ] 버튼 위치는? (상단, 하단, 그리드 옆)

### 5. 기타
- [ ] 탭이 있는가?
- [ ] 팝업이 필요한가?
- [ ] 특수한 컴포넌트가 있는가?

---

## 새로운 컴포넌트 발견 시

**중요**: 아래 목록에 없는 컴포넌트가 필요하면 반드시 사용자에게 요청:

> "이 컴포넌트({컴포넌트명})는 아직 학습되지 않았습니다.
> DAAF에서 해당 컴포넌트의 샘플 JSON을 제공해 주시면 학습하겠습니다."

### 학습 완료된 컴포넌트
- container (65)
- row (66)
- column (67)
- block (68)
- form (69)
- input (70)
- select (71)
- button (73)
- heading (81)
- grid (96)

### 미학습 컴포넌트 (샘플 필요)
- radio (72?) - 미확인
- checkbox - baseCompId 미확인
- textarea - baseCompId 미확인
- datepicker - baseCompId 미확인
- tab - baseCompId 미확인
- modal/popup - baseCompId 미확인
- tree - baseCompId 미확인
- upload - baseCompId 미확인
- 기타 모든 새로운 컴포넌트

---

## Component baseCompId 매핑

| baseCompId | 컴포넌트 타입 | 설명 |
|------------|--------------|------|
| 65 | container | 컨테이너 |
| 66 | row | 행 |
| 67 | column | 열 |
| 68 | block | 블록 |
| 69 | form | 폼 |
| 70 | input | 입력필드 |
| 71 | select | 셀렉트박스 |
| 73 | button | 버튼 |
| 81 | heading | 제목/라벨 |
| 96 | grid | 그리드 테이블 |

## 기본 페이지 구조

```json
{
  "page": {
    "compId": "page-{uniqueId}",
    "builderType": "U",
    "child": [],
    "propertyValue": {
      "appGroupCd": "M"
    }
  }
}
```

## 컴포넌트 템플릿

### Form (폼 컨테이너)
```json
{
  "type": "form",
  "compId": "form-{uniqueId}",
  "baseCompId": 69,
  "child": [],
  "editorAttr": {},
  "viewerAttr": {},
  "propertyValue": {}
}
```

### Row (행)
```json
{
  "type": "row",
  "compId": "row-{uniqueId}",
  "baseCompId": 66,
  "child": [],
  "editorAttr": {},
  "viewerAttr": {},
  "propertyValue": {}
}
```

### Column (열)
```json
{
  "type": "column",
  "compId": "column-{uniqueId}",
  "baseCompId": 67,
  "child": [],
  "editorAttr": {},
  "viewerAttr": {},
  "propertyValue": {
    "column": 12
  }
}
```

### Heading (제목)
```json
{
  "type": "heading",
  "compId": "heading-{uniqueId}",
  "baseCompId": 81,
  "child": [],
  "editorAttr": {},
  "viewerAttr": {},
  "propertyValue": {
    "level": "H5",
    "text": "제목 텍스트"
  }
}
```

### Button (버튼)
```json
{
  "type": "button",
  "compId": "button-{uniqueId}",
  "baseCompId": 73,
  "child": [],
  "editorAttr": {},
  "viewerAttr": {},
  "propertyValue": {
    "label": "버튼명",
    "variant": "contained",
    "size": "small"
  }
}
```

### Input (입력필드)
```json
{
  "type": "input",
  "compId": "input-{uniqueId}",
  "baseCompId": 70,
  "child": [],
  "editorAttr": {},
  "viewerAttr": {},
  "propertyValue": {
    "label": "라벨",
    "type": "text"
  }
}
```

### Select (셀렉트박스)
```json
{
  "type": "select",
  "compId": "select-{uniqueId}",
  "baseCompId": 71,
  "child": [],
  "editorAttr": {},
  "viewerAttr": {},
  "propertyValue": {
    "label": "라벨",
    "options": []
  }
}
```

### Grid (그리드) - 중요! 모든 옵션 필수
```json
{
  "type": "grid",
  "compId": "grid-{uniqueId}",
  "baseCompId": 96,
  "child": [],
  "editorAttr": {
    "serviceUid": "",
    "entityVariable": ""
  },
  "viewerAttr": {},
  "propertyValue": {
    "gridOptions": {
      "columnDefs": [
        {
          "field": "fieldName",
          "headerName": "헤더명",
          "width": 100,
          "editable": false
        }
      ],
      "rowSelection": "single",
      "pagination": true,
      "paginationPageSize": 10
    },
    "mobileGridOptions": {
      "useCustomMobileComponent": false
    }
  }
}
```

## 일반적인 화면 패턴

### 검색 영역 패턴
```
form > row > column > [input/select/button]
```

### 목록 영역 패턴
```
form > row > column > heading
form > row > column > grid
```

### 버튼 그룹 패턴
```
form > row > column > [button, button, ...]
```

## 주의사항

1. **compId는 고유해야 함**: `{컴포넌트타입}-{랜덤문자열}` 형식 사용
2. **Grid는 모든 옵션 필수**: serviceUid, entityVariable, gridOptions, mobileGridOptions
3. **column의 기본값**: `"column": 12` (전체 너비)
4. **점진적 추가 권장**: 한 번에 모든 컴포넌트 추가보다 단계별 추가가 안전
5. **원본 구조 유지**: 특히 Grid는 샘플 구조를 정확히 따라야 함

## 사용 예시

사용자: "검색 영역에 시작일, 종료일, 검색버튼 추가해줘"

응답: 위 템플릿을 조합하여 JSON 생성

---
*이 스킬은 DAAF 프레임워크 UI 생성을 위해 만들어졌습니다.*
