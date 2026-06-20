from __future__ import annotations

from typing import List, Optional, Literal

from pydantic import BaseModel, Field


ComponentType = Literal[
    "container", "custom",
]


class ComponentProps(BaseModel):
    html: Optional[str] = Field(None, description="Full HTML page for the 'custom' type")


class UIComponent(BaseModel):
    type: ComponentType
    props: ComponentProps = Field(default_factory=ComponentProps)


class UIContainer(BaseModel):
    type: Literal["container"] = "container"
    children: List[UIComponent] = Field(default_factory=list)
