//! 标签：给书（以后任何条目）打的标签。同名标签只有一个。

use crate::app::AppState;
use crate::routes::tags;

crate::endpoints! {
    state: AppState;
    /// 标签列表（带每个标签下有几本书）
    GET "/api/v1/tags" => tags::list_tags_route, signed;
    /// 新建标签（同名的已经有了就返回那个）
    POST "/api/v1/tags" => tags::create_tag_route, signed;
    /// 改标签（名字、颜色）
    PATCH "/api/v1/tags/:tag_id" => tags::patch_tag_route, signed;
    /// 删除标签（从打了它的书上去掉）
    DELETE "/api/v1/tags/:tag_id" => tags::delete_tag_route, signed;
}
