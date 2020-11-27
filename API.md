# 스키마 송수신
## schema
``` js
data {
    'S2C': {
        enter: {
            myId: 'string',
            player: [{ name: 'string', id: 'string', isAI: 'boolean', x: 'int16', y: 'int16', point: 'uint16' }],
            food: [{ id: 'string', x: 'int16', y: 'int16', amount: 'uint8' }]
        },
        ...
    },
    'C2S': {
        enter: { name: 'string' },
        ...
    }
}
```
# 클라이언트 수신
## enter
- enter 소켓을 서버로 전송 후, 최초 자신의 ID와 방의 모든 플레이어(AI포함) 데이터 수신
``` js
    data: {
        myId: id,
        player: [{ name, id, isAI, x, y, point }, ...],
        food: [{ id, x, y, amount }, ...]
    }
```
## reset
- 서버가 재시작되어 기존 플레이 데이터가 날아갔을 경우 수신
## ai
- 자신이 컨트롤하는 AI 지렁이 초기화된 데이터 수신
``` js
    data: [id, ...]
```
## new_worm
- 신규 유저 최초 게임 시작시 수신 (자신의 정보도 수신함)
``` js
    data: { name, id, x, y, point }
```
## delete_worm
- 죽은 지렁이 제거
``` js
data: id
```

## position
- 갱신된 지렁이들의 좌표 수신
``` js
    data: { id, x, y }
```
## position_all
- 모든 지렁이들의 좌표 수신
``` js
    data: [{ id, x, y }, ...]
```
## point
- 자신이 컨트롤하는 지렁이 point 송신
``` js
    data: { id, point }
```

## new_food
- 신규 음식 생성시 수신
``` js
    data: { id, x, y, amount }
```
## delete_food
- 음식 삭제
``` js
    data: id
```

## bound_check
- **혹시 여기 있는 지렁이님들?** 이라고 서버가 물어봄
``` js
data: { requestId, bound }
```

## inbound
- **너가 궁금해했던 주변 지렁이 친구야.** 라고 서버가 응답줌
``` js
data: { requestId, responseId, bodies }
```

## map
- 현재 맵에 존재하는 유저들의 대가리 보내줌
``` js
data: [{ x, y }, ...]
```
***

# 클라이언트 송신
## enter
- 게임 시작시 송신
``` js
    data: {
        name: "닉네임"
    }
```
## position
- 자신이 컨트롤하는 지렁이 좌표 송신
``` js
    data: { id, x, y }
```
## eat
- 음식 먹음
``` js
    data: { wormId, foodId }
```
## boost
- 뱉으면서 달림
``` js
    data: { x, y }
```

## bound_check
- **내 주변 지렁이 친구들 누구누구 있어?** 라고 물어보기
``` js
data: { requestId, bound }
```

## inbound
- **내가 그 지렁이다!** 라고 응답하기
``` js
data: { requestId, responseId, bodies }
```

## conflict
- 누구랑 충돌했다고 송신
``` js
data: { id, looserBodies }
```