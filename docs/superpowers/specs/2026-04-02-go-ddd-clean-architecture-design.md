# Go Web 系统架构设计规范
## DDD + Clean Architecture

**版本**: v1.0  
**日期**: 2026-04-02  
**适用**: 团队后端服务架构标准

---

## 1. 架构原则

### 1.1 核心思想

本规范结合**领域驱动设计（DDD）**与**清晰架构（Clean Architecture）**，目标是：

1. **领域为中心** - 业务逻辑独立于框架、UI 和数据库
2. **依赖倒置** - 内层定义接口，外层实现接口
3. **垂直拆分** - 按限界上下文组织代码，而非技术分层
4. **可测试性** - 业务逻辑不依赖外部基础设施即可测试

### 1.2 分层架构

采用四层架构，**Domain 层为核心**（最底层）：

```
                    ┌─────────────────────────────────────┐
                    │       Interface Layer               │
                    │  (HTTP Handler / gRPC Server)       │
                    │  - 输入校验、协议转换、路由           │
                    └───────────────┬─────────────────────┘
                                    │ 依赖
                    ┌───────────────▼─────────────────────┐
                    │      Application Layer              │
                    │  - 用例编排、事务管理、DTO            │
                    │  - 跨聚合协调、权限检查               │
                    └───────────────┬─────────────────────┘
                                    │ 依赖
                    ┌───────────────▼─────────────────────┐
                    │        Domain Layer ◄───────────────┼── 最核心，零外部依赖
                    │  - 实体、值对象、领域服务             │
                    │  - 仓库接口、领域事件                 │
                    └─────────────────────────────────────┘
                                    ▲
                    ┌───────────────┘
                    │ 实现
        ┌───────────┴─────────────────────────────────────┐
        │       Infrastructure Layer                      │
        │  - 仓库实现、数据库访问、外部 API 客户端          │
        │  - 消息队列、缓存实现                            │
        └─────────────────────────────────────────────────┘
```

### 1.3 依赖规则

**铁律：依赖只能由外向内，Domain 层不依赖任何其他层。**

```go
// ✅ 正确：Domain 定义接口
type Repository interface {
    Get(ctx context.Context, id string) (*User, error)
    Save(ctx context.Context, user *User) error
}

// ✅ 正确：Infrastructure 实现接口
type userRepository struct {
    db *xorm.Engine
}

func (r *userRepository) Get(ctx context.Context, id string) (*User, error) {
    // 实现...
}

// ✅ 正确：通过依赖注入组装
func NewApplication(repo domain.Repository) *Application {
    return &Application{repo: repo}
}
```

---

## 2. 目录结构

### 2.1 整体布局

```
project/
├── cmd/
│   ├── server/
│   │   └── main.go              # HTTP/gRPC 服务入口
│   └── client/
│       └── main.go              # 命令行客户端（如有）
├── configs/
│   └── default.yml              # 配置文件，支持环境变量覆盖
├── internal/
│   ├── <module>/                # 限界上下文（垂直拆分）
│   │   ├── domain/              # 领域层 - 核心业务逻辑
│   │   ├── application/         # 应用层 - 用例编排
│   │   ├── interfaces/          # 接口层 - 协议适配
│   │   ├── infrastructure/      # 基础设施层 - 技术实现
│   │   └── <module>.go          # 模块组装（fx Module）
│   └── pkg/                     # 共享基础设施（谨慎使用）
│       ├── eventbus/
│       ├── database/
│       ├── httpsrv/
│       └── grpcsrv/
├── pkg/
│   └── gen/                     # 生成的代码（proto 等）
├── proto/                       # Protobuf 定义
└── scripts/
    └── sql/                     # 数据库迁移脚本
```

### 2.2 限界上下文内部结构

```
internal/user/                   # 用户限界上下文
├── domain/                      # 领域层 - PURE，零外部依赖
│   ├── user.go                  # Aggregate Root + Entity
│   ├── valueobject.go           # 值对象（Email, Password 等）
│   ├── event.go                 # 领域事件定义
│   ├── repository.go            # 仓库接口
│   └── service.go               # 领域服务（如需）
│
├── application/                 # 应用层 - 编排领域对象
│   ├── application.go           # App Service 构造函数
│   ├── command.go               # 命令定义（ChangePassword 等）
│   ├── query.go                 # 查询定义
│   ├── handler.go               # Command/Query Handler
│   ├── dto.go                   # DTO 定义
│   └── assembler.go             # DTO <-> Domain 转换
│
├── interfaces/                  # 接口层 - 适配外部协议
│   ├── http/
│   │   └── handler.go           # HTTP Handler（如使用 REST）
│   └── grpc/
│       └── server.go            # gRPC Server 实现
│
├── infrastructure/              # 基础设施层 - 技术实现
│   ├── persistence/
│   │   ├── repository.go        # Repository 实现
│   │   ├── do.go                # 数据库模型（XORM/GORM）
│   │   └── converter.go         # DO <-> Entity 转换
│   └── messaging/
│       └── publisher.go         # 事件发布实现
│
└── user.go                      # 模块组装（fx Module）
```

---

## 3. 各层职责详解

### 3.1 Domain Layer（领域层）

**定位**：核心业务逻辑，独立于框架、数据库、UI。

**包含内容**：
- **Aggregate Root**（聚合根）：业务不变量的守护者
- **Entity**（实体）：有唯一标识的对象
- **Value Object**（值对象）：通过属性定义，无标识，不可变
- **Domain Service**（领域服务）：处理不适合放在实体中的跨聚合逻辑
- **Repository Interface**（仓库接口）：持久化抽象
- **Domain Event**（领域事件）：记录领域内重要事情

**约束**：
- 零外部依赖（不 import infrastructure、database 包）
- 不依赖其他限界上下文的领域层（通过事件通信）
- 所有状态变更通过领域方法完成，禁止直接修改字段

```go
// domain/user.go
package domain

import (
    "errors"
    "time"

    "github.com/go-jimu/components/mediator"
    "github.com/google/uuid"
)

var (
    ErrInvalidEmail    = errors.New("invalid email format")
    ErrWeakPassword    = errors.New("password too weak")
    ErrUserNotActive   = errors.New("user is not active")
)

// User Aggregate Root
type User struct {
    ID             string
    Name           string
    Email          Email          // Value Object
    HashedPassword Password       // Value Object
    Status         UserStatus     // Value Object
    Events         mediator.EventCollection
    Version        int            // 乐观锁版本
    CreatedAt      time.Time
    UpdatedAt      time.Time
}

// Value Object: Email
type Email string

func (e Email) Validate() error {
    if !strings.Contains(string(e), "@") {
        return ErrInvalidEmail
    }
    return nil
}

// Value Object: Password（哈希后的密码）
type Password []byte

// Value Object: UserStatus
type UserStatus int

const (
    UserStatusInactive UserStatus = iota
    UserStatusActive
    UserStatusSuspended
)

// Factory Method
func NewUser(name, rawPassword string, email Email) (*User, error) {
    if err := email.Validate(); err != nil {
        return nil, err
    }

    hashed, err := hashPassword(rawPassword)
    if err != nil {
        return nil, err
    }

    user := &User{
        ID:             uuid.Must(uuid.NewV7()).String(),
        Name:           name,
        Email:          email,
        HashedPassword: hashed,
        Status:         UserStatusInactive,
        Events:         mediator.NewEventCollection(),
        Version:        0,  // 0 表示新对象
        CreatedAt:      time.Now(),
    }

    // 记录领域事件
    user.Events.Add(EventUserCreated{
        ID:    user.ID,
        Name:  name,
        Email: string(email),
    })

    return user, nil
}

// Domain Method: 修改密码
func (u *User) ChangePassword(oldRaw, newRaw string) error {
    if u.Status != UserStatusActive {
        return ErrUserNotActive
    }

    if !verifyPassword(oldRaw, u.HashedPassword) {
        return errors.New("old password incorrect")
    }

    hashed, err := hashPassword(newRaw)
    if err != nil {
        return err
    }

    u.HashedPassword = hashed
    u.UpdatedAt = time.Now()
    u.Version++

    u.Events.Add(EventPasswordChanged{ID: u.ID})
    return nil
}

// Domain Method: 激活用户
func (u *User) Activate() error {
    if u.Status == UserStatusActive {
        return nil
    }

    u.Status = UserStatusActive
    u.UpdatedAt = time.Now()
    u.Version++

    u.Events.Add(EventUserActivated{ID: u.ID})
    return nil
}

// Repository Interface
//go:generate mockery --name=Repository --case=snake
type Repository interface {
    Get(ctx context.Context, id string) (*User, error)
    FindByEmail(ctx context.Context, email Email) (*User, error)
    Save(ctx context.Context, user *User) error
}
```

### 3.2 Application Layer（应用层）

**定位**：编排领域对象完成用例，定义事务边界。

**包含内容**：
- **Application Service**：用例编排，协调多个聚合/领域服务
- **Command/Query**：操作意图的显式建模
- **Command/Query Handler**：处理具体逻辑
- **DTO**：数据传输对象，解耦内外模型
- **Assembler**：DTO 与 Domain 对象的转换

**约束**：
- 不包含业务规则（在 Domain 层）
- 只依赖 Domain 层
- 事务在此层控制
- 领域事件在持久化成功后分发

```go
// application/command.go
package application

import (
    "context"
    "log/slog"

    "github.com/go-jimu/components/mediator"
)

// Command: 修改密码
type CommandChangePassword struct {
    ID          string
    OldPassword string
    NewPassword string
}

// application/handler.go
package application

import (
    "context"
    "log/slog"

    "github.com/go-jimu/components/sloghelper"
    "github.com/samber/oops"
)

type CommandChangePasswordHandler struct {
    repo domain.Repository
}

func NewCommandChangePasswordHandler(repo domain.Repository) *CommandChangePasswordHandler {
    return &CommandChangePasswordHandler{repo: repo}
}

func (h *CommandChangePasswordHandler) Handle(
    ctx context.Context,
    logger *slog.Logger,
    cmd *CommandChangePassword,
) error {
    // 1. 加载聚合
    user, err := h.repo.Get(ctx, cmd.ID)
    if err != nil {
        return oops.With("user_id", cmd.ID).Wrap(err)
    }

    // 2. 执行业务逻辑（在 Domain 层）
    if err = user.ChangePassword(cmd.OldPassword, cmd.NewPassword); err != nil {
        logger.ErrorContext(ctx, "change password failed",
            sloghelper.Error(err),
            slog.String("user_id", cmd.ID),
        )
        return err
    }

    // 3. 持久化
    if err = h.repo.Save(ctx, user); err != nil {
        return oops.With("user_id", cmd.ID).Wrap(err)
    }

    // 4. 分发领域事件（事务成功后）
    user.Events.Raise(mediator.Default())
    return nil
}
```

### 3.3 Interface Layer（接口层）

**定位**：适配外部协议（HTTP/gRPC），处理输入输出转换。

**包含内容**：
- **HTTP Handler**：REST API 处理
- **gRPC Server**：RPC 服务实现
- **Request/Response**：协议相关的数据结构
- **输入校验**：基础格式校验（业务校验在 Domain）

**约束**：
- 只依赖 Application 和 Domain 层
- 不包含业务逻辑
- 处理协议细节（HTTP 状态码、gRPC 错误码等）

```go
// interfaces/grpc/server.go
package grpc

import (
    "context"

    "connectrpc.com/connect"
    userv1 "example.com/proto/user/v1"
)

type UserServer struct {
    app *application.Application
}

func NewUserServer(app *application.Application) *UserServer {
    return &UserServer{app: app}
}

func (s *UserServer) ChangePassword(
    ctx context.Context,
    req *connect.Request[userv1.ChangePasswordRequest],
) (*connect.Response[userv1.ChangePasswordResponse], error) {
    // 构造命令
    cmd := &application.CommandChangePassword{
        ID:          req.Msg.UserId,
        OldPassword: req.Msg.OldPassword,
        NewPassword: req.Msg.NewPassword,
    }

    // 执行
    if err := s.app.Commands.ChangePassword.Handle(ctx, logger, cmd); err != nil {
        // 转换错误为 gRPC 错误码
        return nil, convertError(err)
    }

    return connect.NewResponse(&userv1.ChangePasswordResponse{}), nil
}

func convertError(err error) error {
    switch {
    case errors.Is(err, domain.ErrUserNotActive):
        return connect.NewError(connect.CodeFailedPrecondition, err)
    case errors.Is(err, domain.ErrInvalidEmail):
        return connect.NewError(connect.CodeInvalidArgument, err)
    default:
        return connect.NewError(connect.CodeInternal, err)
    }
}
```

### 3.4 Infrastructure Layer（基础设施层）

**定位**：实现 Domain 层定义的接口，提供技术能力。

**包含内容**：
- **Repository Implementation**：数据库访问实现
- **Data Object (DO)**：ORM 模型
- **Converter**：DO 与 Domain Entity 的转换
- **External Client**：外部服务客户端
- **Event Publisher**：事件发布实现

**约束**：
- 实现 Domain 层定义的接口
- 不包含业务逻辑
- 处理技术细节（SQL、缓存、重试等）

```go
// infrastructure/persistence/do.go
package persistence

import (
    "xorm.io/xorm"
    "github.com/example/project/internal/pkg/database"
)

// Data Object - XORM 模型
type UserDO struct {
    ID        string             `xorm:"id pk"`
    Name      string             `xorm:"name"`
    Password  []byte             `xorm:"password"`  // 映射到 HashedPassword
    Email     string             `xorm:"email"`
    Status    int                `xorm:"status"`
    Version   int                `xorm:"version"`
    CreatedAt database.Timestamp `xorm:"created_at"`
    UpdatedAt database.Timestamp `xorm:"updated_at"`
    DeletedAt database.Timestamp `xorm:"deleted_at deleted"`
}

func (u UserDO) TableName() string {
    return "user"
}

// infrastructure/persistence/repository.go
package persistence

import (
    "context"

    "github.com/jinzhu/copier"
    "xorm.io/xorm"
    "github.com/samber/oops"

    "github.com/example/project/internal/user/domain"
)

// 编译期检查接口实现
var _ domain.Repository = (*userRepository)(nil)

type userRepository struct {
    db *xorm.Engine
}

// 构造函数返回接口
func NewRepository(db *xorm.Engine) domain.Repository {
    return &userRepository{db: db}
}

func (r *userRepository) Get(ctx context.Context, id string) (*domain.User, error) {
    var do UserDO
    has, err := r.db.Context(ctx).ID(id).Get(&do)
    if err != nil {
        return nil, oops.Wrap(err)
    }
    if !has {
        return nil, oops.With("id", id).Wrap(sql.ErrRecordNotFound)
    }
    return convertToEntity(&do)
}

func (r *userRepository) Save(ctx context.Context, user *domain.User) error {
    do := convertToDO(user)

    if user.Version == 0 {
        // 新对象，INSERT
        _, err := r.db.Context(ctx).Insert(do)
        return oops.Wrap(err)
    }

    // 已有对象，UPDATE（乐观锁）
    affected, err := r.db.Context(ctx).
        Where("version = ?", user.Version-1).
        ID(user.ID).
        Update(do)
    if err != nil {
        return oops.Wrap(err)
    }
    if affected == 0 {
        return oops.New("concurrent modification detected")
    }
    return nil
}

// converter.go
func convertToEntity(do *UserDO) (*domain.User, error) {
    user := new(domain.User)
    if err := copier.Copy(user, do); err != nil {
        return nil, oops.Wrap(err)
    }
    user.Events = mediator.NewEventCollection()
    return user, nil
}

func convertToDO(user *domain.User) *UserDO {
    do := new(UserDO)
    copier.Copy(do, user)
    return do
}
```

---

## 4. DDD 战术设计映射

| DDD 概念 | 归属层 | Go 实现形式 | 说明 |
|----------|--------|-------------|------|
| **Aggregate** | Domain | `struct` + 业务方法 | 聚合根，维护业务不变量 |
| **Entity** | Domain | 带 ID 的 struct | 有唯一标识，可变性 |
| **Value Object** | Domain | 不可变 struct | 通过值判断相等，无副作用 |
| **Domain Service** | Domain | 无状态函数/struct | 跨聚合逻辑 |
| **Repository** | Domain(接口) + Infra(实现) | Interface + Impl | 聚合持久化抽象 |
| **Domain Event** | Domain | `Event` struct | 记录领域重要事情 |
| **Application Service** | Application | 编排用例 | 协调多个聚合/服务 |
| **DTO** | Application/Interface | 数据传输对象 | 解耦内外模型 |
| **Factory** | Domain | 构造函数 | 复杂对象的创建逻辑 |
| **CQRS** | Application | Command + Query 分离 | 命令与查询职责分离 |

---

## 5. 跨限界上下文通信

### 5.1 禁止直接调用

限界上下文之间**禁止直接调用**对方的 Application Service 或 Repository。

```go
// ❌ 错误：Order 上下文直接调用 User 上下文
func (s *OrderAppService) CreateOrder(ctx context.Context, cmd CreateOrderCommand) error {
    // 禁止！
    user, err := s.userApp.GetUser(ctx, cmd.UserID)
    ...
}
```

### 5.2 通过领域事件通信

```go
// ✅ 正确：通过事件总线解耦

// Order 上下文发布事件
func (s *OrderAppService) CreateOrder(ctx context.Context, cmd CreateOrderCommand) error {
    order, err := domain.NewOrder(cmd.UserID, cmd.Items)
    if err != nil {
        return err
    }

    if err = s.repo.Save(ctx, order); err != nil {
        return err
    }

    // 发布事件
    order.Events.Raise(mediator.Default())
    return nil
}

// User 上下文监听事件
func NewUserPointsHandler(repo domain.Repository) *UserPointsHandler {
    return &UserPointsHandler{repo: repo}
}

func (h *UserPointsHandler) Handle(ctx context.Context, event domain.EventOrderCompleted) error {
    // 增加用户积分
    user, err := h.repo.Get(ctx, event.UserID)
    if err != nil {
        return err
    }
    user.AddPoints(event.TotalAmount / 10)
    return h.repo.Save(ctx, user)
}

// 订阅事件（在模块初始化时）
func NewApplication(ev mediator.Mediator, ...) {
    handlers := []mediator.EventHandler{
        NewUserPointsHandler(repo),
    }
    for _, h := range handlers {
        ev.Subscribe(h)
    }
}
```

---

## 6. 命名规范

### 6.1 通用规则

| 类型 | 命名模式 | 示例 |
|------|----------|------|
| 领域事件常量 | `EK` + 名称 | `EKUserCreated` |
| 领域事件结构体 | `Event` + 名称 | `EventUserCreated` |
| Command | `Command` + 动作 | `CommandChangePassword` |
| Command Handler | `Command` + 动作 + `Handler` | `CommandChangePasswordHandler` |
| Query | `Query` + 名称 | `QueryFindUserList` |
| Query Handler | 名称 + `Handler` | `FindUserListHandler` |
| Repository 接口 | `Repository` | `Repository` |
| Repository 实现 | 小写 + `Repository` | `userRepository` |
| Data Object | 实体名 + `DO` | `UserDO` |
| DTO | 用途 + `DTO` | `UserListDTO` |

### 6.2 文件组织

| 文件 | 内容 |
|------|------|
| `domain/<entity>.go` | Aggregate Root + Entity |
| `domain/valueobject.go` | 值对象定义 |
| `domain/event.go` | 领域事件定义 |
| `domain/repository.go` | 仓库接口 |
| `domain/service.go` | 领域服务 |
| `application/command.go` | 命令定义 |
| `application/query.go` | 查询定义 |
| `application/handler.go` | Handler 实现 |
| `application/dto.go` | DTO 定义 |
| `application/assembler.go` | 对象转换 |
| `application/application.go` | App Service + 模块组装 |
| `infrastructure/persistence/do.go` | 数据库模型 |
| `infrastructure/persistence/repository.go` | 仓库实现 |
| `infrastructure/persistence/converter.go` | 转换函数 |

---

## 7. 技术栈

| 用途 | 推荐库 |
|------|--------|
| 依赖注入 | `go.uber.org/fx` |
| RPC/HTTP | `connectrpc.com/connect` |
| HTTP Router | `github.com/go-chi/chi/v5` |
| ORM | `xorm.io/xorm` |
| 验证 | `github.com/go-playground/validator/v10` |
| 日志 | `log/slog` + `github.com/go-jimu/components/sloghelper` |
| 错误处理 | `github.com/samber/oops` |
| 事件总线 | `github.com/go-jimu/components/mediator` |
| 对象拷贝 | `github.com/jinzhu/copier` |

---

## 8. 错误处理策略

### 8.1 分层处理

| 层级 | 处理方式 |
|------|----------|
| Domain / Infrastructure | 使用 `oops.With("key", val).Wrap(err)` 添加上下文 |
| Application | 记录日志后返回：`logger.ErrorContext(...)`<br>`return err` |
| Interface | 转换为协议错误：<br>`connect.NewError(connect.CodeNotFound, err)` |

### 8.2 错误定义

```go
// domain/errors.go
package domain

import "errors"

var (
    // 领域错误
    ErrUserNotFound    = errors.New("user not found")
    ErrInvalidEmail    = errors.New("invalid email format")
    ErrWeakPassword    = errors.New("password too weak")
    ErrUserNotActive   = errors.New("user is not active")
    ErrConcurrentModification = errors.New("concurrent modification detected")
)
```

---

## 9. 完整示例：模块组装

```go
// user.go - 模块组装
package user

import (
    "go.uber.org/fx"

    "github.com/example/project/internal/user/application"
    "github.com/example/project/internal/user/infrastructure/persistence"
    userv1 "github.com/example/project/pkg/gen/proto/user/v1"
    "github.com/example/project/internal/pkg/connectrpc"
)

var Module = fx.Module(
    "domain.user",
    // 基础设施层
    fx.Provide(persistence.NewRepository),
    fx.Provide(persistence.NewQueryRepository),

    // 应用层
    fx.Provide(application.NewApplication),

    // 接口层注册
    fx.Invoke(func(
        srv userv1connect.UserAPIHandler,
        c *connectrpc.ConnectServer,
    ) {
        c.Register(userv1connect.NewUserAPIHandler(
            srv,
            connect.WithInterceptors(c.GetGlobalInterceptors()...),
        ))
    }),
)
```

---

## 10. 关键原则总结

1. **Domain 层零依赖** - 不 import infrastructure、database、http 包
2. **垂直拆分** - 按限界上下文组织，而非技术分层
3. **依赖倒置** - Domain 定义接口，Infrastructure 实现接口
4. **聚合操作** - Repository 只操作聚合根，不操作子实体
5. **状态封装** - 所有状态变更通过领域方法，禁止直接修改字段
6. **事件通信** - 跨限界上下文通过领域事件，禁止直接调用
7. **CQRS** - Command 处理写操作，Query 绕过领域直接查 DB
8. **事务边界** - 在 Application 层控制事务
9. **乐观锁** - 使用 Version 字段处理并发
10. **接口编程** - 依赖接口，通过依赖注入组装

---

**附录**：
- [The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design Reference](https://domainlanguage.com/ddd/reference/)
