<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useFoldersStore } from '../../stores/folders'
import type { ProjectListItem } from '../../types'
import ToolIcon from '../toolbar/ToolIcon.vue'

const props = defineProps<{
  project: ProjectListItem
  x: number
  y: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'open'): void
  (e: 'rename'): void
  (e: 'duplicate'): void
  (e: 'star'): void
  (e: 'archive'): void
  (e: 'trash'): void
  (e: 'restore'): void
  (e: 'delete-permanent'): void
  (e: 'move', folderId: string | null): void
  (e: 'manage-tags'): void
}>()

const foldersStore = useFoldersStore()
const showMoveSubmenu = ref(false)
const menuRef = ref<HTMLElement | null>(null)

const menuStyle = computed(() => {
  // Ensure menu doesn't go off screen
  const menuWidth = 200
  const menuHeight = 300
  let x = props.x
  let y = props.y

  if (typeof window !== 'undefined') {
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10
    }
  }

  return {
    left: `${x}px`,
    top: `${y}px`,
  }
})

function handleClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    emit('close')
  }
}

function moveToFolder(folderId: string | null) {
  emit('move', folderId)
  emit('close')
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('contextmenu', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('contextmenu', handleClickOutside)
})
</script>

<template>
  <Teleport to="body">
    <div ref="menuRef" class="context-menu" :style="menuStyle" @click.stop>
      <!-- Normal project actions -->
      <template v-if="!project.isTrashed">
        <button class="menu-item" @click="emit('open'); emit('close')">
          <ToolIcon name="file" />
          <span>Open</span>
        </button>

        <button class="menu-item" @click="emit('rename'); emit('close')">
          <ToolIcon name="pencil" />
          <span>Rename</span>
        </button>

        <button class="menu-item" @click="emit('duplicate'); emit('close')">
          <ToolIcon name="copy" />
          <span>Duplicate</span>
        </button>

        <div class="menu-divider" />

        <button class="menu-item" @click="emit('star'); emit('close')">
          <ToolIcon :name="project.isStarred ? 'starFilled' : 'star'" />
          <span>{{ project.isStarred ? 'Unstar' : 'Star' }}</span>
        </button>

        <button class="menu-item" @click="emit('manage-tags'); emit('close')">
          <ToolIcon name="tag" />
          <span>Manage tags</span>
        </button>

        <!-- Move to folder submenu -->
        <div
          class="menu-item has-submenu"
          @mouseenter="showMoveSubmenu = true"
          @mouseleave="showMoveSubmenu = false"
        >
          <ToolIcon name="folder" />
          <span>Move to folder</span>
          <ToolIcon name="chevronRight" class="chevron" />

          <div v-if="showMoveSubmenu" class="submenu">
            <button
              class="menu-item"
              :class="{ active: !project.folderId }"
              @click="moveToFolder(null)"
            >
              <ToolIcon name="home" />
              <span>Root (No folder)</span>
            </button>
            <div v-if="foldersStore.folders.length > 0" class="menu-divider" />
            <button
              v-for="folder in foldersStore.sortedFolders"
              :key="folder.id"
              class="menu-item"
              :class="{ active: project.folderId === folder.id }"
              @click="moveToFolder(folder.id)"
            >
              <span class="folder-dot" :style="{ background: folder.color }" />
              <span>{{ folder.name }}</span>
            </button>
          </div>
        </div>

        <div class="menu-divider" />

        <button class="menu-item" @click="emit('archive'); emit('close')">
          <ToolIcon name="archive" />
          <span>{{ project.isArchived ? 'Unarchive' : 'Archive' }}</span>
        </button>

        <button class="menu-item danger" @click="emit('trash'); emit('close')">
          <ToolIcon name="trash" />
          <span>Move to trash</span>
        </button>
      </template>

      <!-- Trashed project actions -->
      <template v-else>
        <button class="menu-item" @click="emit('restore'); emit('close')">
          <ToolIcon name="undo" />
          <span>Restore</span>
        </button>

        <button class="menu-item danger" @click="emit('delete-permanent'); emit('close')">
          <ToolIcon name="trash" />
          <span>Delete permanently</span>
        </button>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 10000;
  background: var(--color-toolbar-bg-solid);
  border: 1px solid var(--color-toolbar-border);
  border-radius: 10px;
  padding: 6px;
  min-width: 180px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  animation: fadeIn 0.1s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  background: transparent;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: all 0.1s ease;
  text-align: left;
  position: relative;
}

.menu-item:hover {
  background: var(--color-toolbar-hover);
}

.menu-item.active {
  background: rgba(99, 102, 241, 0.1);
  color: var(--color-accent-primary);
}

.menu-item.danger {
  color: #ef4444;
}

.menu-item.danger:hover {
  background: rgba(239, 68, 68, 0.1);
}

.menu-item :deep(svg) {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.menu-item .chevron {
  margin-left: auto;
  width: 12px;
  height: 12px;
  opacity: 0.5;
}

.has-submenu {
  position: relative;
}

.submenu {
  position: absolute;
  left: 100%;
  top: 0;
  margin-left: 4px;
  background: var(--color-toolbar-bg-solid);
  border: 1px solid var(--color-toolbar-border);
  border-radius: 10px;
  padding: 6px;
  min-width: 160px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
}

.menu-divider {
  height: 1px;
  background: var(--color-toolbar-border);
  margin: 4px 6px;
}

.folder-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>

